import type { WorktreeLaunchLocation } from '../../worktree-launch-owner'

/** `profile`: an isolated dir Dolphin owns; `linked`: the user's folder; `system`: ~/.claude. */
export type ClaudeLaunchConfigDir = { configDir: string; kind: 'profile' | 'linked' | 'system' }

type Resolver = (launch: WorktreeLaunchLocation) => ClaudeLaunchConfigDir | null

let resolver: Resolver | null = null

/** Installed by the runtime auth service: every process has at most one. */
export function registerClaudeLaunchConfigDirResolver(next: Resolver | null): void {
  resolver = next
}

/**
 * The config dir a host Claude launch in `launch` would use, without preparing it; null when no
 * auth service runs here or the launch would be refused (its pinned account is gone).
 */
export function resolveClaudeLaunchConfigDir(
  launch: WorktreeLaunchLocation
): ClaudeLaunchConfigDir | null {
  return resolver ? resolver(launch) : null
}
