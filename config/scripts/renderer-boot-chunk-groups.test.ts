import { describe, expect, it } from 'vitest'
import { createRendererBootChunkGroups } from '../build-plugins/renderer-boot-chunk-groups'

type FakeModule = { imports?: string[]; dynamicImports?: string[] }

function chunkingContext(graph: Record<string, FakeModule>) {
  const importers = new Map<string, string[]>()
  for (const [id, module] of Object.entries(graph)) {
    for (const imported of module.imports ?? []) {
      importers.set(imported, [...(importers.get(imported) ?? []), id])
    }
  }
  return {
    getModuleInfo: (id: string) =>
      graph[id]
        ? {
            importers: importers.get(id) ?? [],
            importedIds: graph[id].imports ?? [],
            dynamicallyImportedIds: graph[id].dynamicImports ?? []
          }
        : null
  }
}

/** Resolves each module to the boot group whose name function claims it, highest priority first. */
function assign(graph: Record<string, FakeModule>): Record<string, string | null> {
  const { groups } = createRendererBootChunkGroups([
    { name: 'index', moduleId: '/src/main.tsx' },
    { name: 'popout', moduleId: '/src/popout.tsx' }
  ])
  const ctx = chunkingContext(graph)
  const ordered = [...groups].sort((left, right) => right.priority - left.priority)
  return Object.fromEntries(
    Object.keys(graph).map((id) => [
      id,
      ordered.map((group) => group.name(id, ctx)).find((name) => name !== null) ?? null
    ])
  )
}

describe('renderer boot chunk groups', () => {
  it('groups eager modules by the set of windows that boot them', () => {
    expect(
      assign({
        '/src/main.tsx': { imports: ['/src/app.tsx', '/src/shared.ts'] },
        '/src/popout.tsx': { imports: ['/src/shared.ts'] },
        '/src/app.tsx': { imports: ['/src/shared.ts'] },
        '/src/shared.ts': {}
      })
    ).toEqual({
      '/src/main.tsx': null,
      '/src/popout.tsx': null,
      '/src/app.tsx': 'boot-index',
      '/src/shared.ts': 'boot-index-popout'
    })
  })

  it('leaves a module another window only reaches lazily, and its importers, ungrouped', () => {
    expect(
      assign({
        '/src/main.tsx': { imports: ['/src/app.tsx'] },
        '/src/popout.tsx': { dynamicImports: ['/src/settings.tsx'] },
        '/src/app.tsx': { imports: ['/src/settings.tsx', '/src/icons.ts'] },
        '/src/settings.tsx': {},
        '/src/icons.ts': {}
      })
    ).toEqual({
      '/src/main.tsx': null,
      '/src/popout.tsx': null,
      '/src/app.tsx': null,
      '/src/settings.tsx': null,
      '/src/icons.ts': 'boot-index'
    })
  })

  it('never groups lazy-only modules', () => {
    expect(
      assign({
        '/src/main.tsx': { dynamicImports: ['/src/lazy.tsx'] },
        '/src/popout.tsx': {},
        '/src/lazy.tsx': {}
      })['/src/lazy.tsx']
    ).toBeNull()
  })

  it('captures groups shared by more windows first', () => {
    const { groups } = createRendererBootChunkGroups([
      { name: 'index', moduleId: '/a' },
      { name: 'popout', moduleId: '/b' },
      { name: 'web', moduleId: '/c' }
    ])
    expect(groups).toHaveLength(7)
    expect(Math.max(...groups.map((group) => group.priority))).toBe(3)
  })
})
