import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 构建产物要能脱离本地 dev server 独立运行，所以 release manifest 里不能继续保留 development.main。
export function toReleasePluginManifest(manifest) {
  const candidate = manifest && typeof manifest === 'object' ? manifest : {}
  const nextManifest = { ...candidate }

  delete nextManifest.development
  return nextManifest
}

async function prepareDistPlugin() {
  const currentFilePath = fileURLToPath(import.meta.url)
  const repoRoot = path.resolve(path.dirname(currentFilePath), '..')
  const distPluginPath = path.join(repoRoot, 'dist', 'plugin.json')
  const rawManifest = await fs.readFile(distPluginPath, 'utf8')
  const nextManifest = toReleasePluginManifest(JSON.parse(rawManifest))

  await fs.writeFile(distPluginPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8')
}

prepareDistPlugin().catch((error) => {
  console.error('[prepare-dist-plugin] failed to rewrite dist/plugin.json')
  console.error(error)
  process.exitCode = 1
})
