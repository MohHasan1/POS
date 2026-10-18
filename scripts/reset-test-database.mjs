import { existsSync, rmSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = path.join(repositoryRoot, 'test-pos.db')

for (const candidate of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
  if (existsSync(candidate)) unlinkSync(candidate)
}

const mediaPath = path.join(repositoryRoot, 'test-media')
if (existsSync(mediaPath)) rmSync(mediaPath, { force: true, recursive: true })
