import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFilePath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(currentFilePath), '..')
const distPath = path.join(repoRoot, 'dist')
const publicPath = path.join(repoRoot, 'public')

export function buildStaticPlugin() {
  rmSync(distPath, { recursive: true, force: true })
  mkdirSync(distPath, { recursive: true })

  if (existsSync(publicPath)) {
    cpSync(publicPath, distPath, { recursive: true })
  }
}

buildStaticPlugin()
