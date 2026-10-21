import { win32 as pathWin32 } from 'node:path'
import { resolveWindowsGitBashShellPath } from '../git-bash'
import {
  resolveEffectiveWindowsPowerShell,
  type WindowsPowerShellImplementation,
  type WindowsPowerShellShellFamily
} from '../providers/windows-powershell'
import { resolveWindowsPowerShellSpawnChain } from '../providers/windows-powershell-executable'
import {
  configureWindowsShellPathHydration,
  hydrateShellPath,
  mergePathSegments,
  type HydrationResult
} from './hydrate-shell-path'
import type { PersistedShellPath } from './windows-shell-path-cache'

type WindowsShellPathHydrationOptions = {
  configure?: (
    shell: string | null | undefined,
    gitBashPath: string | null,
    fallbackShell: string | null
  ) => void
  hydrate?: (options?: { keepAppliedPath?: boolean }) => Promise<HydrationResult>
  merge?: (segments: string[]) => string[]
  resolveGitBashPath?: (shell: string) => string | null
  resolvePowerShellChain?: (family: 'powershell.exe' | 'pwsh.exe') => string[]
  warn?: (error: unknown) => void
  persistedPath?: PersistedShellPath | null
}

export function createWindowsShellPathHydration(options: WindowsShellPathHydrationOptions = {}) {
  const configure = options.configure ?? configureWindowsShellPathHydration
  const hydrate = options.hydrate ?? hydrateShellPath
  const merge = options.merge ?? mergePathSegments
  const resolveGitBashPath = options.resolveGitBashPath ?? resolveWindowsGitBashShellPath
  const resolvePowerShellChain =
    options.resolvePowerShellChain ?? resolveWindowsPowerShellSpawnChain
  const warn =
    options.warn ??
    ((error: unknown) => {
      console.warn('[shell-path] Windows profile hydration failed; using inherited PATH:', error)
    })
  const persistedPath = options.persistedPath ?? null
  let generation = 0
  let hasHydrated = false
  let probes = Promise.resolve()
  let ready = Promise.resolve()

  const setConfiguredShell = (
    shell: string | null | undefined,
    implementation?: WindowsPowerShellImplementation
  ): string => {
    const requestedShell = shell?.trim() || 'powershell.exe'
    const basename = pathWin32.basename(requestedShell).toLowerCase()
    const shellFamily: WindowsPowerShellShellFamily =
      basename === 'powershell.exe' || basename === 'pwsh.exe' ? basename : undefined
    const effectivePowerShell = resolveEffectiveWindowsPowerShell({
      shellFamily,
      implementation,
      pwshAvailable: true
    })
    if (!effectivePowerShell) {
      const gitBashPath = resolveGitBashPath(requestedShell)
      configure(requestedShell, gitBashPath, null)
      return JSON.stringify([requestedShell, gitBashPath, null])
    }
    const spawnChain = resolvePowerShellChain(effectivePowerShell)
    const profileShell = spawnChain[0] ?? 'cmd.exe'
    const fallbackShell = spawnChain.slice(1).find((candidate) => {
      const candidateBasename = pathWin32.basename(candidate).toLowerCase()
      return candidateBasename === 'powershell.exe' || candidateBasename === 'pwsh.exe'
    })
    configure(profileShell, null, fallbackShell ?? null)
    return JSON.stringify([profileShell, null, fallbackShell ?? null])
  }

  return {
    configure: (shell, implementation?: WindowsPowerShellImplementation) => {
      generation += 1
      setConfiguredShell(shell, implementation)
    },
    hydrate: (shell, implementation?: WindowsPowerShellImplementation) => {
      generation += 1
      const requestGeneration = generation
      const shellKey = setConfiguredShell(shell, implementation)
      // Why launch only: a mid-session shell change can race an in-flight probe's PATH restore.
      const cachedSegments = hasHydrated ? null : (persistedPath?.load(shellKey) ?? null)
      hasHydrated = true
      if (cachedSegments) {
        // Cached entries go ahead of the inherited PATH, so a vanished one falls through to it.
        merge(cachedSegments)
      }
      probes = probes.then(async () => {
        if (requestGeneration !== generation) {
          return
        }
        try {
          const result = await hydrate(cachedSegments ? { keepAppliedPath: true } : undefined)
          if (requestGeneration === generation && result.ok) {
            merge(result.segments)
            persistedPath?.save(shellKey, result.segments)
          }
        } catch (error) {
          if (requestGeneration === generation) {
            warn(error)
          }
        }
      })
      ready = cachedSegments ? Promise.resolve() : probes
      return probes
    },
    whenReady: async () => {
      let pending = ready
      while (true) {
        await pending
        if (pending === ready) {
          return
        }
        pending = ready
      }
    }
  }
}
