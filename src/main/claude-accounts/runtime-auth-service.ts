import type { Store } from '../persistence'
import {
  getSelectedClaudeAccountIdForTarget,
  type ClaudeAccountSelectionTarget
} from './runtime-selection'
import { ClaudeRuntimeAuthSync } from './runtime-auth/runtime-auth-sync'
import type { WorktreeLaunchLocation } from '../worktree-launch-owner'
import { resolveClaudeLaunchAccountOverride } from './worktree-claude-account-override'
import { getClaudePinnedConfigDir, isClaudePinnedConfigDirPath } from './managed-auth-path'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'

export type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'

export class ClaudeRuntimeAuthService extends ClaudeRuntimeAuthSync {
  constructor(store: Store) {
    super(store)
    this.initializeLastSyncedState()
    void this.safeSyncForCurrentSelection()
  }

  async prepareForClaudeLaunch(
    target?: ClaudeAccountSelectionTarget,
    launch?: WorktreeLaunchLocation
  ): Promise<ClaudeRuntimeAuthPreparation> {
    const effectiveTarget = target ?? this.getDefaultAccountSelectionTarget()
    const pinned = await this.preparePinnedLaunchIfAny(effectiveTarget, launch)
    if (pinned) {
      return pinned
    }
    await this.syncForCurrentSelection(effectiveTarget)
    return this.getPreparation(effectiveTarget)
  }

  /** The config dir a structured create in `launch` pins, materialized; null keeps the global home. */
  async preparePinnedConfigDirForLaunch(launch: WorktreeLaunchLocation): Promise<string | null> {
    const prepared = await this.preparePinnedLaunchIfAny({ runtime: 'host' }, launch)
    return prepared?.runtime === 'host' ? (prepared.envPatch.CLAUDE_CONFIG_DIR ?? null) : null
  }

  /**
   * Re-materializes a structured session's pinned home before each acquisition, so a restart or
   * reacquire never runs on credentials the global sync or another pane has since rotated.
   * False: not a pinned home. Throws when the pinned account can no longer serve it.
   */
  async preparePinnedConfigDirForStructuredLaunch(configDir: string): Promise<boolean> {
    const account = this.store
      .getSettings()
      .claudeManagedAccounts.find(
        (candidate) =>
          candidate.managedAuthRuntime !== 'wsl' &&
          getClaudePinnedConfigDir(candidate.id) === configDir
      )
    if (!account) {
      if (isClaudePinnedConfigDirPath(configDir)) {
        throw new Error('The Claude account this chat was pinned to is no longer available.')
      }
      return false
    }
    const prepared = await this.serializeMutation(() => this.preparePinnedAccountLaunch(account))
    if (!prepared) {
      throw new Error('The Claude account this chat was pinned to has unusable credentials.')
    }
    return true
  }

  private async preparePinnedLaunchIfAny(
    target: ClaudeAccountSelectionTarget,
    launch: WorktreeLaunchLocation | undefined
  ): Promise<ClaudeRuntimeAuthPreparation | null> {
    const override = resolveClaudeLaunchAccountOverride({
      source: this.store,
      settings: this.store.getSettings(),
      target: this.resolveWslDefaultTarget(target),
      launch
    })
    if (override.kind === 'unavailable') {
      // Why: the worktree card shows the same fallback; the log ties it to this launch.
      console.warn(
        `[claude-worktree-account] worktree ${override.worktreeId} pins an unavailable account (${override.reason}); using the active account`
      )
      return null
    }
    if (override.kind !== 'override') {
      return null
    }
    const prepared = await this.serializeMutation(() =>
      this.preparePinnedAccountLaunch(override.account)
    )
    if (!prepared) {
      console.warn(
        `[claude-worktree-account] worktree ${override.worktreeId} account credentials are unusable; using the active account`
      )
    }
    return prepared
  }

  async prepareForRateLimitFetch(
    target?: ClaudeAccountSelectionTarget
  ): Promise<ClaudeRuntimeAuthPreparation> {
    const effectiveTarget = target ?? this.getDefaultAccountSelectionTarget()
    await this.syncForCurrentSelection(effectiveTarget)
    return this.getPreparation(effectiveTarget)
  }

  async syncForCurrentSelection(target?: ClaudeAccountSelectionTarget): Promise<void> {
    await this.serializeMutation(() =>
      this.doSyncForCurrentSelection(target ?? this.getDefaultAccountSelectionTarget())
    )
  }

  async forceMaterializeCurrentSelectionForRollback(): Promise<void> {
    await this.serializeMutation(async () => {
      const settings = this.store.getSettings()
      if (!settings.activeClaudeManagedAccountId) {
        const previousAccount = this.getActiveAccount(
          settings.claudeManagedAccounts,
          this.lastSyncedAccountId
        )
        await this.restoreSystemDefaultSnapshot(
          previousAccount ? await this.readManagedCredentials(previousAccount) : null,
          previousAccount ? await this.readManagedOauthAccount(previousAccount) : undefined
        )
        this.lastSyncedAccountId = null
        return
      }
      await this.doSyncForCurrentSelection()
    })
  }

  getRuntimeConfigDir(target?: ClaudeAccountSelectionTarget): string {
    return this.getPreparation(target).configDir
  }

  private initializeLastSyncedState(): void {
    const settings = this.store.getSettings()
    this.lastSyncedAccountId = getSelectedClaudeAccountIdForTarget(settings, { runtime: 'host' })
  }

  private async safeSyncForCurrentSelection(): Promise<void> {
    try {
      await this.syncForCurrentSelection()
    } catch (error) {
      console.warn('[claude-runtime-auth] Failed to sync runtime auth state:', error)
    }
  }

  private serializeMutation<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(fn, fn)
    this.mutationQueue = next.catch(() => {})
    return next
  }

  // Why: re-auth/add-account write fresh managed tokens; skip the next read-back so stale runtime tokens can't overwrite them.
  clearLastWrittenCredentialsJson(
    accountId = this.store.getSettings().activeClaudeManagedAccountId
  ): void {
    if (accountId === this.store.getSettings().activeClaudeManagedAccountId) {
      this.lastWrittenCredentialsJson = null
    }
    this.skipNextReadBackForAccountId = accountId
  }
}
