import { registerClaudeApiWorktreeSource } from '../claude-api/claude-api-launch'
import type { Store } from '../persistence'
import {
  getSelectedClaudeAccountIdForTarget,
  type ClaudeAccountSelectionTarget
} from './runtime-selection'
import { ClaudeRuntimeAuthSync } from './runtime-auth/runtime-auth-sync'
import type { WorktreeLaunchLocation } from '../worktree-launch-owner'
import { resolveClaudeLaunchAccountOverride } from './worktree-claude-account-override'
import { getClaudeManagedAccountsRoot, isClaudePinnedConfigDirPath } from './managed-auth-path'
import { getClaudeAccountConfigDir, isDefaultClaudeConfigDir } from './claude-account-config-dir'
import { registerClaudeProfileRootSources } from './profile/claude-profile-roots'
import type {
  ClaudeLaunchLocation,
  ClaudeRuntimeAuthPreparation
} from './runtime-auth/runtime-auth-types'
import { resolveClaudeResumeOwner } from './profile/claude-resume-owner'
import { RESUME_OWNER_PROVENANCE_SUFFIX } from './profile/claude-resume-provenance'
import { discoverClaudeShellSelector } from './profile/claude-shell-selector-discovery'
import {
  registerClaudeLaunchConfigDirResolver,
  type ClaudeLaunchConfigDir
} from './profile/claude-launch-config-dir'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { isClaudeApiKeyAccount } from '../../shared/claude-api-account'

export type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'

function claudeLaunchOverrideUnavailableMessage(reason: string): string {
  if (reason === 'other-runtime') {
    return 'The Claude account chosen for this project belongs to another runtime. Choose another account in the project settings.'
  }
  if (reason === 'api-key-account') {
    return 'The Claude account chosen for this project is an API account, which plain Claude launches never use. Choose another account in the project settings.'
  }
  return 'The Claude account chosen for this project was removed. Choose another account in the project settings.'
}

export class ClaudeRuntimeAuthService extends ClaudeRuntimeAuthSync {
  constructor(store: Store) {
    super(store)
    this.initializeLastSyncedState()
    registerClaudeLaunchConfigDirResolver((launch) => this.resolveLaunchConfigDir(launch))
    registerClaudeApiWorktreeSource(this.store)
    registerClaudeProfileRootSources({
      managedAccountsRoot: getClaudeManagedAccountsRoot,
      // Why default excluded: readers already scan ~/.claude as the system profile.
      linkedConfigDirs: () =>
        this.store
          .getSettings()
          .claudeManagedAccounts.flatMap((account) =>
            account.linkedConfigDir && !isDefaultClaudeConfigDir(account.linkedConfigDir)
              ? [account.linkedConfigDir]
              : []
          )
    })
    void this.safeSyncForCurrentSelection()
  }

  /** The host config dir a launch in `launch` uses, with no side effects; null when refused. */
  resolveLaunchConfigDir(launch: WorktreeLaunchLocation): ClaudeLaunchConfigDir | null {
    const override = resolveClaudeLaunchAccountOverride({
      source: this.store,
      settings: this.store.getSettings(),
      target: { runtime: 'host' },
      launch
    })
    if (override.kind === 'unavailable') {
      return null
    }
    const account =
      override.kind === 'override'
        ? override.account
        : this.getActiveHostProfileAccount({ runtime: 'host' })
    if (!account) {
      return { configDir: this.getRuntimeConfigDir({ runtime: 'host' }), kind: 'system' }
    }
    if (account.managedAuthRuntime === 'wsl') {
      return null
    }
    return {
      configDir: getClaudeAccountConfigDir(account),
      kind: account.linkedConfigDir ? 'linked' : 'profile'
    }
  }

  async prepareForClaudeLaunch(
    target?: ClaudeAccountSelectionTarget,
    launch?: ClaudeLaunchLocation
  ): Promise<ClaudeRuntimeAuthPreparation> {
    const effectiveTarget = target ?? this.getDefaultAccountSelectionTarget()
    const resumed = await this.prepareResumeOwnerLaunchIfAny(effectiveTarget, launch)
    if (resumed) {
      return resumed
    }
    const pinned = await this.preparePinnedLaunchIfAny(effectiveTarget, launch)
    if (pinned) {
      return pinned
    }
    await this.syncForCurrentSelection(effectiveTarget)
    return (
      (await this.prepareActiveProfileLaunchIfAny(effectiveTarget)) ??
      this.getPreparation(effectiveTarget)
    )
  }

  /** The profile a structured create in `launch` runs in, materialized; null keeps ~/.claude. */
  async preparePinnedConfigDirForLaunch(launch: WorktreeLaunchLocation): Promise<string | null> {
    const prepared =
      (await this.preparePinnedLaunchIfAny({ runtime: 'host' }, launch)) ??
      (await this.prepareActiveProfileLaunchIfAny({ runtime: 'host' }))
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
          getClaudeAccountConfigDir(candidate) === configDir
      )
    if (!account || isClaudeApiKeyAccount(account)) {
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
    // Why refuse: each account is an isolated profile, so falling back would silently run this
    // workspace with another account's instructions and accesses.
    if (override.kind === 'unavailable') {
      throw new Error(claudeLaunchOverrideUnavailableMessage(override.reason))
    }
    if (override.kind !== 'override') {
      return null
    }
    const prepared = await this.serializeMutation(() =>
      this.preparePinnedAccountLaunch(override.account)
    )
    if (!prepared) {
      throw new Error(
        `The Claude account ${override.account.email} has invalid credentials. Sign in again in Settings > Accounts.`
      )
    }
    return prepared
  }

  /**
   * A resume runs in the profile that holds the transcript: the CLI finds sessions only under its
   * own config dir, and copying one across would hand one account's conversation to another.
   * Null when the session is in the profile this launch would use anyway, or in none.
   */
  private async prepareResumeOwnerLaunchIfAny(
    target: ClaudeAccountSelectionTarget,
    launch: ClaudeLaunchLocation | undefined
  ): Promise<ClaudeRuntimeAuthPreparation | null> {
    const sessionId = launch?.resumeSessionId
    if (!sessionId || this.resolveWslDefaultTarget(target).runtime !== 'host') {
      return null
    }
    const override = resolveClaudeLaunchAccountOverride({
      source: this.store,
      settings: this.store.getSettings(),
      target: this.resolveWslDefaultTarget(target),
      launch
    })
    const owner = resolveClaudeResumeOwner({
      sessionId,
      intended:
        override.kind === 'override' ? override.account : this.getActiveHostProfileAccount(target),
      // Why: an API account's transcripts resume only through its own agent, billed to its key.
      accounts: this.store
        .getSettings()
        .claudeManagedAccounts.filter((account) => !isClaudeApiKeyAccount(account)),
      systemDir: this.getPreparation({ runtime: 'host' }).configDir,
      menuFolders: () => discoverClaudeShellSelector().folders.map((folder) => folder.configDir)
    })
    if (owner.kind === 'none') {
      return null
    }
    if (owner.kind === 'folder') {
      return {
        configDir: owner.configDir,
        runtime: 'host',
        wslDistro: null,
        wslLinuxConfigDir: null,
        // Why no variable for ~/.claude: setting it moves the state file and the Keychain item.
        envPatch: isDefaultClaudeConfigDir(owner.configDir)
          ? {}
          : { CLAUDE_CONFIG_DIR: owner.configDir },
        stripAuthEnv: false,
        provenance: `${owner.isSystem ? 'system' : 'menu-folder'}${RESUME_OWNER_PROVENANCE_SUFFIX}`
      }
    }
    const prepared = await this.serializeMutation(() =>
      this.preparePinnedAccountLaunch(owner.account)
    )
    if (!prepared) {
      throw new Error(
        `This conversation belongs to the Claude account ${owner.account.email}, whose credentials are invalid. Sign in again in Settings > Accounts.`
      )
    }
    return prepared
  }

  /** The active host-managed account's profile; null when the system login (~/.claude) is active. */
  private async prepareActiveProfileLaunchIfAny(
    target: ClaudeAccountSelectionTarget
  ): Promise<ClaudeRuntimeAuthPreparation | null> {
    const account = this.getActiveHostProfileAccount(target)
    if (!account) {
      return null
    }
    const prepared = await this.serializeMutation(() => this.preparePinnedAccountLaunch(account))
    if (!prepared) {
      throw new Error(
        `The active Claude account ${account.email} has invalid credentials. Sign in again in Settings > Accounts, or switch to another account.`
      )
    }
    return prepared
  }

  private getActiveHostProfileAccount(
    target: ClaudeAccountSelectionTarget
  ): ClaudeManagedAccount | null {
    const normalized = this.resolveWslDefaultTarget(target)
    if (normalized.runtime !== 'host') {
      return null
    }
    const settings = this.store.getSettings()
    const account = this.getActiveAccount(
      settings.claudeManagedAccounts,
      getSelectedClaudeAccountIdForTarget(settings, normalized)
    )
    return account && account.managedAuthRuntime !== 'wsl' ? account : null
  }

  async prepareForRateLimitFetch(
    target?: ClaudeAccountSelectionTarget
  ): Promise<ClaudeRuntimeAuthPreparation> {
    const effectiveTarget = target ?? this.getDefaultAccountSelectionTarget()
    await this.syncForCurrentSelection(effectiveTarget)
    return (
      (await this.prepareActiveProfileLaunchIfAny(effectiveTarget)) ??
      this.getPreparation(effectiveTarget)
    )
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

  /** The config dir launches of `target` use: the active account's profile, else the system one. */
  getRuntimeConfigDir(target?: ClaudeAccountSelectionTarget): string {
    const account = this.getActiveHostProfileAccount(
      target ?? this.getDefaultAccountSelectionTarget()
    )
    return account ? getClaudeAccountConfigDir(account) : this.getPreparation(target).configDir
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
