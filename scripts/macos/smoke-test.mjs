import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const [appPath, upgradeSource] = process.argv.slice(2)
assert.equal(process.platform, 'darwin')
assert(appPath, 'Provide the path to a copied QuickPOS.app.')

const temporary = mkdtempSync(join(tmpdir(), 'QuickPOS smoke '))
const application = resolve(appPath)
const binary = join(application, 'Contents/MacOS/QuickPOS')
const runtime = join(application, 'Contents/Resources/runtime/node')
const live = new Set()

function sqlite(database, command) {
  return execFileSync('/usr/bin/sqlite3', ['-batch', '-noheader', database, command], { encoding: 'utf8' }).trim()
}

async function reservePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return { server, port: server.address().port }
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function configure(directory, port) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'config.json'), JSON.stringify({ port }))
}

function launch(directory) {
  const processHandle = spawn(binary, ['--headless'], {
    env: { ...process.env, QUICKPOS_MAC_TEST_DATA_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  live.add(processHandle)
  let stdout = ''
  let stderr = ''
  processHandle.stdout.setEncoding('utf8').on('data', (value) => { stdout += value })
  processHandle.stderr.setEncoding('utf8').on('data', (value) => { stderr += value })
  const exited = new Promise((resolve) => {
    processHandle.once('close', (code, signal) => {
      live.delete(processHandle)
      resolve({ code, signal, stderr })
    })
    processHandle.once('error', (error) => {
      live.delete(processHandle)
      resolve({ code: null, signal: null, stderr: error.message })
    })
  })
  return {
    processHandle,
    exited,
    async ready(port) {
      const url = 'http://127.0.0.1:' + port
      const timeout = Date.now() + 125_000
      while (!stdout.includes(url + '/') && Date.now() < timeout) {
        if (!live.has(processHandle)) break
        await delay(50)
      }
      assert(stdout.includes(url + '/'), 'QuickPOS did not report readiness. ' + stderr)
      return url
    },
  }
}

async function expectExit(app, expectedCode) {
  const result = await Promise.race([
    app.exited,
    delay(12_000, null, { ref: false }).then(() => { throw new Error('QuickPOS did not exit.') }),
  ])
  assert.equal(result.code, expectedCode, result.stderr)
  return result
}

async function stop(app, url, directory) {
  app.processHandle.kill('SIGTERM')
  await expectExit(app, 0)
  assert(!existsSync(join(directory, 'run', 'instance.json')))
  await assert.rejects(fetch(url + '/api/quickpos/health', { signal: AbortSignal.timeout(2_000) }))
}

function backupPaths(directory) {
  return readdirSync(join(directory, 'backups'))
    .filter((entry) => entry.startsWith('pre-migration-'))
    .map((entry) => join(directory, 'backups', entry))
}

function businessData(database) {
  return sqlite(database, 'SELECT id, country_code, seller_name_english FROM shop_settings ORDER BY id;') + '\n' +
    sqlite(database, 'SELECT id, invoice_number, total_minor FROM invoices ORDER BY id;') + '\n' +
    sqlite(database, 'SELECT id, filename FROM media ORDER BY id;')
}

function mediaChecksums(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name)
      const hash = createHash('sha256').update(readFileSync(path)).digest('hex')
      return [path.slice(folder.length), hash]
    }).sort()
}

try {
  assert.equal(
    execFileSync(runtime, ['-p', 'process.arch'], { encoding: 'utf8' }).trim(),
    'arm64',
  )
  const first = join(temporary, 'Fresh installation')
  const reserved = await reservePort()
  const port = reserved.port
  configure(first, port)

  try {
    const conflict = await expectExit(launch(first), 1)
    assert.match(conflict.stderr, /Port .* is in use/)
  } finally {
    await close(reserved.server)
  }

  const app = launch(first)
  const url = await app.ready(port)
  const build = await fetch(url + '/api/quickpos/health').then((response) => response.json())
  assert.equal(build.app, 'QuickPOS')
  assert.equal(build.database, 'ready')
  const business = await fetch(url + '/business')
  assert(business.ok && (await business.text()).includes('Business Information'))

  const manifest = await fetch(url + '/manifest.webmanifest').then((response) => response.json())
  assert.equal(manifest.name, 'QuickPOS')
  for (const path of [
    '/web-app-manifest-192x192.png',
    '/_next/image?url=%2Fweb-app-manifest-192x192.png&w=64&q=75',
  ]) {
    const icon = await fetch(url + path)
    assert(icon.ok && (await icon.arrayBuffer()).byteLength > 100, path)
  }

  const duplicate = await expectExit(launch(first), 1)
  assert.match(duplicate.stderr, /already running/)
  await stop(app, url, first)

  const data = join(first, 'data')
  const db = join(data, 'pos.db')
  const secret = readFileSync(join(data, 'payload-secret'), 'utf8')
  assert.equal(secret.length, 64)
  assert.equal(sqlite(db, 'PRAGMA integrity_check;'), 'ok')
  assert.equal(sqlite(db, 'PRAGMA foreign_key_check;'), '')
  assert.equal(sqlite(db, "SELECT count(*) FROM sqlite_master WHERE name='supply_purchases';"), '1')
  writeFileSync(join(data, 'media', 'persistence-fixture.txt'), 'QuickPOS smoke fixture')

  const reopened = launch(first)
  await reopened.ready(port)
  await stop(reopened, url, first)
  assert.equal(readFileSync(join(data, 'payload-secret'), 'utf8'), secret)
  const [backup] = backupPaths(first)
  assert(backup, 'Reopening an existing database must create a backup.')
  assert.equal(sqlite(join(backup, 'pos.db'), 'PRAGMA integrity_check;'), 'ok')
  assert.equal(readFileSync(join(backup, 'media', 'persistence-fixture.txt'), 'utf8'), 'QuickPOS smoke fixture')

  sqlite(db, "INSERT INTO payload_migrations(name, batch) VALUES ('dev', -1);")
  const unprepared = await expectExit(launch(first), 1)
  assert.match(unprepared.stderr, /reconciled copy/)
  assert.equal(sqlite(db, "SELECT count(*) FROM payload_migrations WHERE batch=-1;"), '1')

  if (upgradeSource) {
    const target = join(temporary, 'Transferred installation')
    configure(target, port)
    cpSync(upgradeSource, join(target, 'data'), { recursive: true })
    const targetData = join(target, 'data')
    const targetDatabase = join(targetData, 'pos.db')
    const before = businessData(targetDatabase)
    const beforeMedia = mediaChecksums(join(targetData, 'media'))
    const beforeSecret = readFileSync(join(targetData, 'payload-secret'), 'utf8')

    const transferred = launch(target)
    await transferred.ready(port)
    await stop(transferred, url, target)
    assert.equal(businessData(targetDatabase), before)
    assert.deepEqual(mediaChecksums(join(targetData, 'media')), beforeMedia)
    assert.equal(readFileSync(join(targetData, 'payload-secret'), 'utf8'), beforeSecret)
    assert.equal(sqlite(targetDatabase, 'PRAGMA integrity_check;'), 'ok')
    assert.equal(sqlite(targetDatabase, 'PRAGMA foreign_key_check;'), '')
    assert.equal(sqlite(targetDatabase, "SELECT count(*) FROM sqlite_master WHERE name='supply_purchases';"), '1')
    assert.equal(businessData(join(backupPaths(target)[0], 'pos.db')), before)
    console.log('Verified upgrade of a transferred database and preservation of invoices, settings, media, and secret.')
  }

  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', application])
  console.log('Packaged Mac app passed startup, port conflict, single instance, assets, shutdown, restart, and backup checks.')
} finally {
  for (const processHandle of live) processHandle.kill('SIGTERM')
  if (live.size) await delay(2_000)
  if (!live.size) rmSync(temporary, { recursive: true, force: true })
  else console.error('Check the launcher and logs in ' + temporary)
}
