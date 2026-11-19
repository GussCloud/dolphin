import { resolve } from 'node:path'
import type { RendererBootEntry } from './renderer-boot-chunk-groups'

// Why: each pop-out (agent dashboard, Design) and the avatar is a top-level window with its own
// React root, so it gets its own HTML entry while reusing the preload/window.api. `index` must
// stay listed — overriding input otherwise drops electron-vite's default renderer entry.
const RENDERER_WINDOW_ENTRIES = [
  { name: 'index', html: 'index.html', module: 'main.tsx' },
  { name: 'popout', html: 'popout.html', module: 'popout.tsx' },
  { name: 'design-popout', html: 'design-popout.html', module: 'design-popout.tsx' },
  { name: 'agent-avatar', html: 'agent-avatar.html', module: 'agent-avatar.tsx' },
  { name: 'web', html: 'web-index.html', module: 'web/main.tsx' }
] as const

/** Rollup `input`: one HTML entry per renderer window. */
export function rendererWindowHtmlInputs(): Record<string, string> {
  return Object.fromEntries(
    RENDERER_WINDOW_ENTRIES.map(({ name, html }) => [name, resolve(`src/renderer/${html}`)])
  )
}

/** The module each window boots, for createRendererBootChunkGroups. */
export function rendererWindowBootEntries(): RendererBootEntry[] {
  return RENDERER_WINDOW_ENTRIES.map(({ name, module }) => ({
    name,
    moduleId: resolve(`src/renderer/src/${module}`)
  }))
}
