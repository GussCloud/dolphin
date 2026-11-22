import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { satisfiesDolphinEngineRange } from '../../shared/plugins/plugin-manifest'
import { hashPluginTree } from './plugin-content-hash'

// Why: the official plugins and examples ship inside the app; a manifest whose engines range this
// version cannot meet is refused at load ("requires Dolphin >=1.4.0 (this is 0.2.55)").
const APP_VERSION: string = JSON.parse(readFileSync('package.json', 'utf8')).version
const SHIPPED_PLUGIN_ROOTS = ['resources/plugins/launch', 'examples/plugins']

function shippedPluginDirs(): string[] {
  return SHIPPED_PLUGIN_ROOTS.flatMap((root) =>
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name))
  )
}

describe('plugins that ship with the app', () => {
  it.each(shippedPluginDirs())('%s accepts this app version', (dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, 'dolphin-plugin.json'), 'utf8'))
    expect(satisfiesDolphinEngineRange(APP_VERSION, manifest.engines.dolphin)).toBe(true)
  })

  it('keeps every bundled content hash in step with the plugin files', async () => {
    const bundled = JSON.parse(
      readFileSync('resources/plugins/launch/bundled-plugins.json', 'utf8')
    )
    for (const entry of bundled.plugins) {
      const hashed = await hashPluginTree(join('resources/plugins/launch', entry.path))
      expect(hashed, entry.pluginKey).toMatchObject({ ok: true, hash: entry.contentHash })
    }
  })
})
