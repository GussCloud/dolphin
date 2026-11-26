import { randomUUID } from 'node:crypto'
import { isClaudeApiKeyAccount } from '../../shared/claude-api-account'
import type {
  ClaudeApiKeyAccountRequest,
  ClaudeApiKeyStatus,
  ClaudeManagedAccount,
  ClaudeRateLimitAccountsState
} from '../../shared/managed-account-types'
import type { Store } from '../persistence'
import type { ClaudeAccountSelection } from './claude-account-selection'
import { getClaudeAccountConfigDir } from './claude-account-config-dir'
import {
  CLAUDE_API_KEY_SECURE_STORAGE_UNAVAILABLE_MESSAGE,
  clearClaudeApiKey,
  getClaudeApiKeyStatus,
  isClaudeApiKeyEncryptionAvailable,
  saveClaudeApiKey
} from './claude-api-key-store'
import type { ClaudeManagedAuthLocation } from './claude-managed-auth-storage'
import { getClaudePinnedConfigDir } from './managed-auth-path'
import { setupClaudeApiProfile } from './profile/claude-api-profile-setup'
import { ClaudeRuntimePathResolver } from './runtime-paths'

const MAX_LABEL_LENGTH = 80

export type ClaudeApiKeyAccountDependencies = {
  store: Store
  selection: ClaudeAccountSelection
  createManagedAuth: (accountId: string) => Promise<ClaudeManagedAuthLocation>
  removeManagedAuth: (accountId: string, path: string) => Promise<void>
}

function normalizeLabel(label: unknown): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (!trimmed) {
    throw new Error('Give the API account a name.')
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`The API account name must be at most ${MAX_LABEL_LENGTH} characters.`)
  }
  return trimmed
}

/**
 * Claude accounts billed to an Anthropic API key instead of a subscription. Each is an isolated
 * profile like any managed account, created without an OAuth login; its key lives only encrypted.
 */
export class ClaudeApiKeyAccounts {
  constructor(private readonly dependencies: ClaudeApiKeyAccountDependencies) {}

  async add(request: ClaudeApiKeyAccountRequest): Promise<ClaudeRateLimitAccountsState> {
    const label = normalizeLabel(request.label)
    if (typeof request.apiKey !== 'string' || !request.apiKey.trim()) {
      throw new Error('Anthropic API key is required')
    }
    // Why before anything is created: a refusal must leave no half-made account behind.
    if (!isClaudeApiKeyEncryptionAvailable()) {
      throw new Error(CLAUDE_API_KEY_SECURE_STORAGE_UNAVAILABLE_MESSAGE)
    }
    const copyFromConfigDir = this.resolveCopySource(request.copyFromAccountId)
    const id = randomUUID()
    const location = await this.dependencies.createManagedAuth(id)
    try {
      saveClaudeApiKey(id, request.apiKey)
      const userPaths = new ClaudeRuntimePathResolver().getRuntimePaths()
      await setupClaudeApiProfile({
        profileDir: getClaudePinnedConfigDir(id),
        userConfigDir: userPaths.configDir,
        userStatePath: userPaths.configPath,
        copyFromConfigDir
      })
      const now = Date.now()
      const account: ClaudeManagedAccount = {
        id,
        email: '',
        label,
        managedAuthPath: location.managedAuthPath,
        managedAuthRuntime: 'host',
        authMethod: 'api-key',
        createdAt: now,
        updatedAt: now,
        lastAuthenticatedAt: now
      }
      const settings = this.dependencies.store.getSettings()
      this.dependencies.store.updateSettings({
        claudeManagedAccounts: [...settings.claudeManagedAccounts, account]
      })
    } catch (error) {
      clearClaudeApiKey(id)
      await this.dependencies.removeManagedAuth(id, location.managedAuthPath)
      throw error
    }
    return this.dependencies.selection.snapshot()
  }

  replaceKey(accountId: string, apiKey: unknown): ClaudeApiKeyStatus {
    this.requireApiKeyAccount(accountId)
    if (typeof apiKey !== 'string') {
      throw new Error('Anthropic API key must be a string')
    }
    saveClaudeApiKey(accountId, apiKey)
    return getClaudeApiKeyStatus(accountId)
  }

  status(accountId: string): ClaudeApiKeyStatus {
    this.requireApiKeyAccount(accountId)
    return getClaudeApiKeyStatus(accountId)
  }

  private requireApiKeyAccount(accountId: string): ClaudeManagedAccount {
    const account = this.dependencies.selection.requireAccount(accountId)
    if (!isClaudeApiKeyAccount(account)) {
      throw new Error('That Claude account is not an API account.')
    }
    return account
  }

  private resolveCopySource(accountId: string | null | undefined): string | null {
    if (!accountId) {
      return null
    }
    const source = this.dependencies.selection.requireAccount(accountId)
    if (source.managedAuthRuntime === 'wsl') {
      throw new Error('A WSL account profile cannot be copied into an API account.')
    }
    return getClaudeAccountConfigDir(source)
  }
}
