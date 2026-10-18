import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const APP_NAME = 'QuickPOS'
const DEFAULT_PORT = 3210
const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_PATH = '/api/quickpos/health'
const MAX_BACKUPS = 10

const launcherDirectory = path.dirname(fileURLToPath(import.meta.url))
const installationDirectory = path.resolve(launcherDirectory, '..')
const applicationDirectory = path.join(installationDirectory, 'app')
const runtimeNode = path.join(installationDirectory, 'runtime', 'node.exe')
const serverEntry = path.join(applicationDirectory, 'server.js')
const localAppData = process.env.LOCALAPPDATA

if (!localAppData) {
  throw new Error(
    'LOCALAPPDATA is not available. QuickPOS can only start in a Windows user session.',
  )
}

const userDirectory = path.join(localAppData, APP_NAME)
const dataDirectory = path.join(userDirectory, 'data')
const backupDirectory = path.join(userDirectory, 'backups')
const logDirectory = path.join(userDirectory, 'logs')
const runDirectory = path.join(userDirectory, 'run')
const databasePath = path.join(dataDirectory, 'pos.db')
const mediaDirectory = path.join(dataDirectory, 'media')
const secretPath = path.join(dataDirectory, 'payload-secret')
const configPath = path.join(userDirectory, 'config.json')
const instancePath = path.join(runDirectory, 'instance.json')
const lockPath = path.join(runDirectory, 'instance.lock')
const serverLogPath = path.join(logDirectory, 'server.log')
const launcherLogPath = path.join(logDirectory, 'launcher.log')

let lockHandle
let ownsInstance = false
let serverProcess
let serverLogHandle

function ensureDirectories() {
  for (const directory of [
    userDirectory,
    dataDirectory,
    mediaDirectory,
    backupDirectory,
    logDirectory,
    runDirectory,
  ]) {
    mkdirSync(directory, { recursive: true })
  }
}

function log(message) {
  ensureDirectories()
  appendFileSync(launcherLogPath, `${new Date().toISOString()} ${message}${os.EOL}`, 'utf8')
}

function showStartupError(message) {
  log(`ERROR ${message}`)

  if (process.env.QUICKPOS_HEADLESS === '1') return

  const command = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '[System.Windows.Forms.MessageBox]::Show(',
    '$env:QUICKPOS_LAUNCH_ERROR,',
    "'QuickPOS could not start',",
    '[System.Windows.Forms.MessageBoxButtons]::OK,',
    '[System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null',
  ].join(' ')

  spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', command],
    {
      env: {
        ...process.env,
        QUICKPOS_LAUNCH_ERROR: `${message}\n\nDetails: ${launcherLogPath}`,
      },
      windowsHide: true,
    },
  )
}

function restrictUserDirectory() {
  const identity = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  const sid = identity.stdout?.match(/S-\d-(?:\d+-)+\d+/)?.[0]

  if (!sid) {
    log(
      'WARNING Could not determine the Windows user SID; LocalAppData inheritance remains in use.',
    )
    return
  }

  const result = spawnSync(
    'icacls.exe',
    [userDirectory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`],
    { encoding: 'utf8', windowsHide: true },
  )

  if (result.status !== 0) {
    log(
      'WARNING Could not tighten the QuickPOS data directory ACL; LocalAppData inheritance remains in use.',
    )
  }
}

function readConfiguration() {
  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${JSON.stringify({ port: DEFAULT_PORT }, null, 2)}${os.EOL}`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
  }

  const configuration = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''))
  const requestedPort = process.env.QUICKPOS_PORT || configuration.port
  const port = Number(requestedPort)

  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(
      `The configured port must be an integer from 1024 through 65535. Received: ${requestedPort}`,
    )
  }

  return { port }
}

function readOrCreateSecret() {
  if (!existsSync(secretPath)) {
    writeFileSync(secretPath, randomBytes(48).toString('base64url'), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
  }

  const secret = readFileSync(secretPath, 'utf8').trim()
  if (secret.length < 48) {
    throw new Error(`The persistent Payload secret is invalid: ${secretPath}`)
  }

  return secret
}

function readRelease() {
  try {
    return JSON.parse(
      readFileSync(path.join(installationDirectory, 'release.json'), 'utf8').replace(/^\uFEFF/, ''),
    )
  } catch {
    return { version: 'unknown' }
  }
}

function toLibSQLFileURL(filePath) {
  // @libsql/client passes the parsed file URL path directly to the native
  // driver. On Windows, the WHATWG form (file:///C:/...) leaves a leading
  // slash that is not a valid native drive path, so retain URL escaping while
  // converting it to the libSQL-supported file:C:/... form.
  return pathToFileURL(filePath).href.replace(/^file:\/\/\/(?=[a-z]:\/)/i, 'file:')
}

function backupDatabase() {
  if (!existsSync(databasePath) || statSync(databasePath).size === 0) return

  const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')
  const destination = path.join(backupDirectory, `pre-migration-${timestamp}`)
  mkdirSync(destination, { recursive: false })

  for (const source of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (existsSync(source)) copyFileSync(source, path.join(destination, path.basename(source)))
  }
  cpSync(mediaDirectory, path.join(destination, 'media'), { recursive: true })

  writeFileSync(
    path.join(destination, 'backup.json'),
    `${JSON.stringify(
      {
        applicationVersion: readRelease().version,
        createdAt: new Date().toISOString(),
        database: 'pos.db',
        media: 'media',
      },
      null,
      2,
    )}${os.EOL}`,
    'utf8',
  )

  const backups = readdirSync(backupDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('pre-migration-'))
    .map((entry) => entry.name)
    .sort()
    .reverse()

  for (const obsolete of backups.slice(MAX_BACKUPS)) {
    rmSync(path.join(backupDirectory, obsolete), { recursive: true, force: true })
  }

  log(`Created database backup ${destination}`)
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false

  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const finish = (open) => {
      socket.destroy()
      resolve(open)
    }

    socket.setTimeout(1_000)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

async function probeHealth(baseURL) {
  try {
    const response = await fetch(`${baseURL}${HEALTH_PATH}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2_000),
    })
    const body = await response.json().catch(() => null)

    if (body?.app !== APP_NAME) return { kind: 'foreign' }
    if (response.ok && body.status === 'ok' && body.database === 'ready') {
      return { body, kind: 'ready' }
    }

    return { kind: 'startup-error' }
  } catch {
    return { kind: 'unavailable' }
  }
}

function openBrowser(baseURL) {
  if (process.env.QUICKPOS_NO_BROWSER === '1') return

  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', baseURL], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  browser.unref()
}

function readInstance() {
  try {
    return JSON.parse(readFileSync(instancePath, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function removeStaleInstanceFiles() {
  rmSync(instancePath, { force: true })
  rmSync(lockPath, { force: true })
}

async function waitForReady(baseURL, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      throw new Error(`The QuickPOS server stopped during startup (exit code ${child.exitCode}).`)
    }

    const health = await probeHealth(baseURL)
    if (health.kind === 'ready') return health.body
    if (health.kind === 'startup-error') {
      throw new Error(
        `Database startup or migration failed. QuickPOS was stopped to protect the data. See ${serverLogPath}`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`QuickPOS did not become ready within ${timeoutMs / 1_000} seconds.`)
}

async function stopServerAndWait() {
  if (!serverProcess || serverProcess.exitCode !== null) return

  serverProcess.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => serverProcess.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])

  if (serverProcess.exitCode === null) {
    spawnSync('taskkill.exe', ['/PID', String(serverProcess.pid), '/T', '/F'], {
      windowsHide: true,
    })
  }
}

function acquireInstanceLock() {
  lockHandle = openSync(lockPath, 'wx', 0o600)
  ownsInstance = true
}

function writeInstance(instance) {
  const temporaryPath = `${instancePath}.${process.pid}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(instance, null, 2)}${os.EOL}`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporaryPath, instancePath)
}

function cleanUpInstance() {
  if (!ownsInstance) return

  rmSync(instancePath, { force: true })

  if (lockHandle !== undefined) {
    closeSync(lockHandle)
    lockHandle = undefined
  }

  rmSync(lockPath, { force: true })
  ownsInstance = false

  if (serverLogHandle !== undefined) {
    closeSync(serverLogHandle)
    serverLogHandle = undefined
  }
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('The packaged QuickPOS launcher supports Windows only.')
  }
  if (!existsSync(runtimeNode) || !existsSync(serverEntry)) {
    throw new Error('The QuickPOS installation is incomplete. Reinstall QuickPOS and try again.')
  }

  ensureDirectories()
  restrictUserDirectory()

  const { port } = readConfiguration()
  const baseURL = `http://127.0.0.1:${port}`
  const initialHealth = await probeHealth(baseURL)

  if (initialHealth.kind === 'ready') {
    log(`QuickPOS is already running at ${baseURL}; opening it in the browser.`)
    openBrowser(baseURL)
    return
  }
  if (initialHealth.kind === 'startup-error') {
    throw new Error(
      `An existing QuickPOS instance reported a startup failure. See ${serverLogPath}`,
    )
  }

  if (existsSync(lockPath)) {
    const existing = readInstance()
    if (isProcessAlive(existing?.supervisorPid)) {
      log('Another QuickPOS launcher is starting the server; waiting for it to become ready.')
      await waitForReady(baseURL, STARTUP_TIMEOUT_MS)
      openBrowser(baseURL)
      return
    }
    removeStaleInstanceFiles()
  }

  if (await isPortOpen(port)) {
    throw new Error(
      `Port ${port} is already used by another application. Change the port in ${configPath} and try again.`,
    )
  }

  acquireInstanceLock()

  if (await isPortOpen(port)) {
    cleanUpInstance()
    throw new Error(`Port ${port} became unavailable while QuickPOS was starting.`)
  }

  const payloadSecret = readOrCreateSecret()
  backupDatabase()

  const shutdownToken = randomBytes(32).toString('base64url')
  const databaseURL = toLibSQLFileURL(databasePath)
  serverLogHandle = openSync(serverLogPath, 'a')
  serverProcess = spawn(runtimeNode, [serverEntry], {
    cwd: applicationDirectory,
    env: {
      ...process.env,
      DATABASE_ADAPTER: 'sqlite',
      DATABASE_URL: databaseURL,
      HOSTNAME: '127.0.0.1',
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'production',
      PAYLOAD_SECRET: payloadSecret,
      PORT: String(port),
      QUICKPOS_DESKTOP: '1',
      QUICKPOS_MEDIA_DIR: mediaDirectory,
      QUICKPOS_MIGRATE_ON_STARTUP: '1',
      QUICKPOS_SHUTDOWN_TOKEN: shutdownToken,
    },
    stdio: ['ignore', serverLogHandle, serverLogHandle],
    windowsHide: true,
  })

  writeInstance({
    appDirectory: installationDirectory,
    baseURL,
    port,
    serverPid: serverProcess.pid,
    shutdownToken,
    startedAt: new Date().toISOString(),
    supervisorPid: process.pid,
  })

  const stopServer = () => {
    if (serverProcess && serverProcess.exitCode === null) serverProcess.kill('SIGTERM')
  }
  process.once('SIGINT', stopServer)
  process.once('SIGTERM', stopServer)

  try {
    const health = await waitForReady(baseURL, STARTUP_TIMEOUT_MS, serverProcess)
    log(
      `QuickPOS ${readRelease().version} is ready at ${baseURL} (${health.products} products, ${health.invoices} invoices).`,
    )
    openBrowser(baseURL)
    const exitCode = await new Promise((resolve) => serverProcess.once('exit', resolve))
    log(`QuickPOS server stopped with exit code ${exitCode ?? 0}.`)
  } catch (error) {
    await stopServerAndWait()
    throw error
  } finally {
    cleanUpInstance()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  try {
    cleanUpInstance()
  } catch {}
  showStartupError(message)
  process.exitCode = 1
})
