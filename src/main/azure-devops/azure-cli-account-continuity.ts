import { runAzureCli, runAzureCliJson } from './azure-cli-runner'

// Keeps a renewed `az login` on the identity and default subscription the user had before.

export type AccountUser = { name: string; type: string | null }
export type CurrentAccount = {
  tenantId: string | null
  subscriptionId: string | null
  user: AccountUser | null
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readField(value: unknown, key: string): unknown {
  return isJsonObject(value) ? value[key] : null
}

function readStringField(value: unknown, key: string): string | null {
  const field = readField(value, key)
  return typeof field === 'string' && field ? field : null
}

/** Null when az has no current account (signed out, or never signed in). */
export async function readCurrentAzureCliAccount(): Promise<CurrentAccount | null> {
  try {
    const raw = await runAzureCliJson(['account', 'show'])
    const user = readField(raw, 'user')
    const name = readStringField(user, 'name')
    return {
      tenantId: readStringField(raw, 'tenantId'),
      subscriptionId: readStringField(raw, 'id'),
      user: name ? { name, type: readStringField(user, 'type') } : null
    }
  } catch {
    return null
  }
}

function isSameUser(before: AccountUser, after: AccountUser): boolean {
  return before.name.toLowerCase() === after.name.toLowerCase() && before.type === after.type
}

const SIGNED_OUT_NEW_ACCOUNT_ERROR =
  'Signed in with a different Azure account, so Dolphin signed it out again. Sign in with the account Dolphin used before.'
const KEPT_KNOWN_ACCOUNT_ERROR =
  'Signed in with a different Azure account. Sign in with the account Dolphin used before.'

/** Lower-cased users az already holds; null when unreadable, which forbids any sign-out. */
export async function readKnownAzureCliUsers(): Promise<Set<string> | null> {
  try {
    const raw = await runAzureCliJson(['account', 'list', '--all'])
    if (!Array.isArray(raw)) {
      return null
    }
    const names = raw.map((entry) => readStringField(readField(entry, 'user'), 'name'))
    return new Set(names.flatMap((name) => (name ? [name.toLowerCase()] : [])))
  } catch {
    return null
  }
}

/**
 * An unattended device-code login must renew the same identity; a different one would
 * silently re-point every Azure DevOps call. Returns an error when az now holds another user,
 * signing it out only if it is new to az, so an account the user already had is never removed.
 */
export async function rejectDifferentAzureCliUser(
  before: AccountUser,
  knownUsers: ReadonlySet<string> | null
): Promise<string | null> {
  const after = await readCurrentAzureCliAccount()
  if (!after?.user) {
    console.warn('[azure-devops] could not confirm the account after az login')
    return null
  }
  if (isSameUser(before, after.user)) {
    return null
  }
  if (!knownUsers || knownUsers.has(after.user.name.toLowerCase())) {
    return KEPT_KNOWN_ACCOUNT_ERROR
  }
  try {
    const result = await runAzureCli(['logout', '--username', after.user.name])
    if (result.code !== 0 || result.timedOut) {
      console.warn('[azure-devops] could not sign out the unexpected account')
    }
  } catch {
    console.warn('[azure-devops] could not sign out the unexpected account')
  }
  return SIGNED_OUT_NEW_ACCOUNT_ERROR
}

// Why: with login experience v2 off, `az login` picks its own default subscription.
export async function restoreDefaultAzureCliSubscription(subscriptionId: string): Promise<void> {
  try {
    const result = await runAzureCli(['account', 'set', '--subscription', subscriptionId])
    if (result.code !== 0 || result.timedOut) {
      console.warn(
        '[azure-devops] could not restore the default subscription',
        result.stderr.trim()
      )
    }
  } catch (error) {
    console.warn('[azure-devops] could not restore the default subscription', error)
  }
}
