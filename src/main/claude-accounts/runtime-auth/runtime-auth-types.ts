import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import type { ClaudeEnvPatch } from '../environment'
import type { WorktreeLaunchLocation } from '../../worktree-launch-owner'

export type ClaudeRuntimeAuthPreparation = {
  configDir: string
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
  wslLinuxConfigDir?: string | null
  envPatch: ClaudeEnvPatch
  stripAuthEnv: boolean
  managedRefreshDeferredByLivePty?: boolean
  provenance: string
}

/** Where a Claude launch runs; a resume also names the session, which ties it to one profile. */
export type ClaudeLaunchLocation = WorktreeLaunchLocation & { resumeSessionId?: string | null }

export type ClaudeSystemDefaultSnapshot = {
  credentialsJson: string | null
  configOauthAccount: unknown
  keychainCredentialsJson: string | null
  scopedKeychainCredentialsJson?: string | null
  legacyKeychainCredentialsJson?: string | null
  scopedKeychainCredentialsCaptured?: boolean
  legacyKeychainCredentialsCaptured?: boolean
  capturedAt: number
}

export type ClaudeAuthIdentity = {
  accountUuid: string | null
  email: string | null
  organizationUuid: string | null
}

export type ClaudeReadBackResult =
  | { status: 'unchanged' | 'persisted' }
  | {
      status: 'rejected'
      runtimeCredentialsChanged: boolean
      hasValidChangedRuntimeCredentials: boolean
      runtimeCredentialsJson?: string
    }
export type ClaudeReadBackMatch =
  | { kind: 'matched'; account: ClaudeManagedAccount; managedCredentialsJson: string }
  | { kind: 'none' | 'ambiguous' }
export type ClaudeKeychainReadResult =
  | { status: 'captured'; credentialsJson: string | null }
  | { status: 'failed' }
export type ClaudeKeychainSnapshotValue =
  | { status: 'captured'; credentialsJson: string | null }
  | { status: 'unknown' }
export type ClaudeRefreshTokenComparison = 'same' | 'different' | 'missing'
export type ClaudeRuntimeCredentialCandidate = {
  credentialsJson: string
  runtimeOauthAccount: unknown
}

export const RUNTIME_OAUTH_ACCOUNT_PARSE_ERROR = Symbol('runtime-oauth-account-parse-error')
