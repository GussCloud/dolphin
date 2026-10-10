import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  bootGraphForbiddenPayloads,
  findForbiddenBootPayloads,
  findForeignBootGroupLoads,
  prunedAwayEnglishSignature,
  readRendererBootGraph,
  RENDERER_BUILD_DIR
} from './renderer-boot-graph.mjs'

const rendererDir = path.join(process.cwd(), RENDERER_BUILD_DIR)
const built = fs.existsSync(path.join(rendererDir, 'index.html'))

describe('renderer boot graph', () => {
  it('derives an English probe the runtime-required catalog does not ship', () => {
    const signature = prunedAwayEnglishSignature()
    const runtimeRequired = fs.readFileSync(
      'src/renderer/src/i18n/en-runtime-required.json',
      'utf8'
    )
    const full = fs.readFileSync('src/renderer/src/i18n/locales/en.json', 'utf8')

    expect(full).toContain(JSON.stringify(signature).slice(1, -1))
    expect(runtimeRequired).not.toContain(JSON.stringify(signature).slice(1, -1))
  })

  // Requires `pnpm run build:electron-vite`; the same check runs unconditionally
  // at the end of that build, so CI can never skip it.
  it.runIf(built)('preloads none of the deferred payloads before first paint', () => {
    expect(findForbiddenBootPayloads(rendererDir, bootGraphForbiddenPayloads())).toEqual([])
  })

  it("flags a window that lazily loads another window's boot group or entry", () => {
    const manifest = {
      'index.html': { file: 'index.js', isEntry: true, imports: ['_boot-index.js'] },
      'popout.html': { file: 'popout.js', isEntry: true, dynamicImports: ['_lazy.js'] },
      '_boot-index.js': { file: 'boot-index.js', name: 'boot-index' },
      '_lazy.js': { file: 'lazy.js', name: 'lazy', imports: ['_boot-index.js', 'index.html'] }
    }

    expect(findForeignBootGroupLoads(manifest)).toEqual([
      { entry: 'popout.html', chunk: 'boot-index.js' },
      { entry: 'popout.html', chunk: 'index.js' }
    ])
    delete manifest['_lazy.js'].imports
    expect(findForeignBootGroupLoads(manifest)).toEqual([])
  })

  it.runIf(built)("loads no other window's boot group lazily", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rendererDir, '.vite', 'manifest.json'), 'utf8')
    )
    expect(findForeignBootGroupLoads(manifest)).toEqual([])
  })

  it.runIf(built)('reads the entry chunk plus its modulepreload graph', () => {
    const { chunks, totalBytes } = readRendererBootGraph(rendererDir)

    expect(chunks.length).toBeGreaterThan(10)
    expect(totalBytes).toBeGreaterThan(0)
  })
})
