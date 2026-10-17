import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_NAME = 'QuickPOS'
const STOP_TIMEOUT_MS = 15_000
const launcherDirectory = path.dirname(fileURLToPath(import.meta.url))
const installationDirectory = path.resolve(launcherDirectory, '..')
const localAppData = process.env.LOCALAPPDATA

if (!localAppData) {
  throw new Error('LOCALAPPDATA is not available.')
}

const userDirectory = path.join(localAppData, APP_NAME)
const instancePath = path.join(userDirectory, 'run', 'instance.json')
const lockPath = path.join(userDirectory, 'run', 'instance.lock')
const logPath = path.join(userDirectory, 'logs', 'launcher.log')

function log(message) {
  appendFileSync(logPath, `${new Date().toISOString()} ${message}${os.EOL}`, 'utf8')
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

async function waitForExit(pid) {
  const deadline = Date.now() + STOP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('QuickPOS did not stop within 15 seconds.')
}

async function main() {
  if (!existsSync(instancePath)) return

  const instance = JSON.parse(readFileSync(instancePath, 'utf8').replace(/^\uFEFF/, ''))
  if (
    typeof instance.appDirectory !== 'string' ||
    path.resolve(instance.appDirectory).toLowerCase() !== installationDirectory.toLowerCase()
  ) {
    throw new Error('The running QuickPOS instance does not belong to this installation.')
  }

  if (!isProcessAlive(instance.serverPid)) {
    rmSync(instancePath, { force: true })
    rmSync(lockPath, { force: true })
    return
  }

  const response = await fetch(`${instance.baseURL}/api/quickpos/shutdown`, {
    headers: { 'x-quickpos-shutdown-token': instance.shutdownToken },
    method: 'POST',
    signal: AbortSignal.timeout(5_000),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok || body?.app !== APP_NAME) {
    throw new Error(`QuickPOS refused the shutdown request (HTTP ${response.status}).`)
  }

  await waitForExit(instance.serverPid)
  await waitForExit(instance.supervisorPid)
  log('QuickPOS stopped normally.')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  log(`ERROR ${message}`)
  process.exitCode = 1
})
