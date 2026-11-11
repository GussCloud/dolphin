import type {
  GhAccountBindingInventory,
  GhAccountBindingValidationResult
} from '../../shared/github/auth-types'
import type { GhAccountProfile } from '../../shared/github/account-commit-identity'

export type GithubAccountApi = {
  listBindableAccounts: (args: {
    repoPath: string
    repoId?: string
    refreshCapability?: boolean
  }) => Promise<GhAccountBindingInventory>
  /** Every gh login on this host (no repo needed), optionally narrowed to one GitHub host. */
  listHostAccounts: (args?: {
    host?: string
    refreshCapability?: boolean
    /** Lists the logins of that WSL distro's gh (the one a WSL project's git uses); local desktop only. */
    wslDistro?: string
  }) => Promise<GhAccountBindingInventory>
  /** One login's profile, read with its own token; web clients (no local gh) resolve null. */
  accountProfile: (binding: { host: string; user: string }) => Promise<GhAccountProfile | null>
  validateAccountBinding: (args: {
    repoPath: string
    repoId?: string
    host: string
    user: string
  }) => Promise<GhAccountBindingValidationResult>
}
