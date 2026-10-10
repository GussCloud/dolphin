type BootModuleInfo = {
  importers: readonly string[]
  importedIds: readonly string[]
  dynamicallyImportedIds: readonly string[]
}
type BootChunkingContext = { getModuleInfo(moduleId: string): BootModuleInfo | null }

export type RendererBootEntry = { name: string; moduleId: string }

const normalizeModuleId = (moduleId: string): string => moduleId.replaceAll('\\', '/')

function nonEmptySubsets<T>(items: readonly T[]): T[][] {
  const subsets: T[][] = []
  for (let mask = 1; mask < 1 << items.length; mask++) {
    subsets.push(items.filter((_, index) => (mask & (1 << index)) !== 0))
  }
  return subsets
}

/**
 * Groups the modules renderer entries statically import into one chunk per set
 * of entries that boot them. Without this, rolldown splits the eager graph at
 * every lazy-chunk share point, so the main window fetched ~350 chunks (two
 * thirds under 2 KB) before first paint, and per-module loading — not JS
 * execution — dominated time-to-mount.
 *
 * A module is grouped only when every entry that can reach it, even lazily,
 * already imports it eagerly; otherwise a lazy import from another window would
 * evaluate the whole group there. Rolldown pulls a grouped module's
 * dependencies into its group, so importers of an ungrouped module stay
 * ungrouped too, and groups shared by more entries are captured first.
 */
export function createRendererBootChunkGroups(entries: readonly RendererBootEntry[]) {
  let groupByModule: Map<string, string> | null = null

  const closure = (
    ctx: BootChunkingContext,
    entryId: string,
    includeDynamic: boolean
  ): Set<string> => {
    const seen = new Set<string>()
    const queue = [entryId]
    while (queue.length > 0) {
      const moduleId = queue.pop()
      if (moduleId === undefined || seen.has(moduleId)) {
        continue
      }
      seen.add(moduleId)
      const info = ctx.getModuleInfo(moduleId)
      queue.push(...(info?.importedIds ?? []))
      if (includeDynamic) {
        queue.push(...(info?.dynamicallyImportedIds ?? []))
      }
    }
    return seen
  }

  const entriesReaching = (
    ctx: BootChunkingContext,
    includeDynamic: boolean
  ): Map<string, string> => {
    const entriesByModule = new Map<string, string[]>()
    for (const entry of entries) {
      for (const moduleId of closure(ctx, normalizeModuleId(entry.moduleId), includeDynamic)) {
        const names = entriesByModule.get(moduleId) ?? []
        names.push(entry.name)
        entriesByModule.set(moduleId, names)
      }
    }
    return new Map([...entriesByModule].map(([moduleId, names]) => [moduleId, names.join('-')]))
  }

  const assignGroups = (ctx: BootChunkingContext): Map<string, string> => {
    const eager = entriesReaching(ctx, false)
    const reachable = entriesReaching(ctx, true)
    const ungroupable = [...eager.keys()].filter(
      (moduleId) => reachable.get(moduleId) !== eager.get(moduleId)
    )
    // Why: entry modules mount a React root; no other window may ever load their chunk.
    ungroupable.push(...entries.map((entry) => normalizeModuleId(entry.moduleId)))
    const excluded = new Set<string>()
    while (ungroupable.length > 0) {
      const moduleId = ungroupable.pop()
      if (moduleId === undefined || excluded.has(moduleId)) {
        continue
      }
      excluded.add(moduleId)
      ungroupable.push(...(ctx.getModuleInfo(moduleId)?.importers ?? []))
    }
    const groups = new Map<string, string>()
    for (const [moduleId, names] of eager) {
      if (!excluded.has(moduleId)) {
        groups.set(moduleId, names)
      }
    }
    return groups
  }

  return {
    groups: nonEmptySubsets(entries.map((entry) => entry.name)).map((names) => {
      const key = names.join('-')
      return {
        name: (moduleId: string, ctx: BootChunkingContext): string | null => {
          groupByModule ??= assignGroups(ctx)
          return groupByModule.get(normalizeModuleId(moduleId)) === key ? `boot-${key}` : null
        },
        // Why: a module's dependencies are booted by a superset of its entries, so wider groups go first.
        priority: names.length
      }
    })
  }
}
