import type { ClaudeManagedAccount } from './managed-account-types'

/** An account billed to an API key; plain `claude` launches, pins and usage polling skip it. */
export function isClaudeApiKeyAccount(
  account: Pick<ClaudeManagedAccount, 'authMethod'> | null | undefined
): boolean {
  return account?.authMethod === 'api-key'
}

/** What the UI shows for an account: the label of an api-key account, else the login email. */
export function claudeAccountDisplayName(
  account: Pick<ClaudeManagedAccount, 'authMethod' | 'email' | 'label'>
): string {
  return isClaudeApiKeyAccount(account) ? account.label?.trim() || account.email : account.email
}
