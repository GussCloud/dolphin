import type { Repo } from '../../../../shared/repo-types'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'

/** False when an older host silently dropped the field, which the UI reports as "not enforced". */
export function isRepoAccountFieldEnforced(
  field: 'azureDevOpsAccountId',
  requested: string | null,
  echoed: Repo | undefined
): boolean
export function isRepoAccountFieldEnforced(
  field: 'commitIdentity',
  requested: CommitIdentity | null,
  echoed: Repo | undefined
): boolean
export function isRepoAccountFieldEnforced(
  field: 'azureDevOpsAccountId' | 'commitIdentity',
  requested: string | CommitIdentity | null,
  echoed: Repo | undefined
): boolean {
  const value = echoed?.[field] ?? null
  if (requested === null || value === null) {
    return requested === value
  }
  if (typeof requested === 'string' || typeof value === 'string') {
    return requested === value
  }
  return requested.name === value.name && requested.email === value.email
}
