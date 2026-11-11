import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import {
  parseGhAccountProfile,
  type GhAccountProfile
} from '../../shared/github/account-commit-identity'
import { acquire, ghExecFileAsync, release } from './gh-utils'

/** Profile of one gh login, read with that login's own token; null when it cannot be read. */
export async function getGhAccountProfile(binding: unknown): Promise<GhAccountProfile | null> {
  const account = normalizeGhAccountBinding(binding)
  if (!account) {
    return null
  }
  await acquire()
  try {
    const { stdout } = await ghExecFileAsync(
      ['api', 'user', '--jq', '{login: .login, name: .name, email: .email, id: .id}'],
      { encoding: 'utf-8', host: account.host, ghAccount: account }
    )
    return parseGhAccountProfile(stdout, account.host)
  } catch {
    return null
  } finally {
    release()
  }
}

/**
 * Makes `binding` gh's active login on its host again, e.g. after `gh auth login` activated a
 * newly added account. Argv only (no shell), and `--flag=value` so a login starting with `-`
 * is never read as a flag. False when gh refuses or the login is unknown.
 */
export async function switchGhActiveAccount(binding: unknown): Promise<boolean> {
  const account = normalizeGhAccountBinding(binding)
  if (!account) {
    return false
  }
  try {
    await ghExecFileAsync(
      ['auth', 'switch', `--hostname=${account.host}`, `--user=${account.user}`],
      {
        encoding: 'utf-8'
      }
    )
    return true
  } catch {
    return false
  }
}
