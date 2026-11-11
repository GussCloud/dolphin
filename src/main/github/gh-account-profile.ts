import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import type { GhAccountProfile } from '../../shared/github/account-commit-identity'
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
    const raw: unknown = JSON.parse(stdout)
    if (!raw || typeof raw !== 'object' || !('login' in raw) || typeof raw.login !== 'string') {
      return null
    }
    const text = (key: 'name' | 'email'): string | null =>
      key in raw && typeof raw[key] === 'string' && raw[key].trim() ? raw[key].trim() : null
    const id = 'id' in raw && typeof raw.id === 'number' && Number.isFinite(raw.id) ? raw.id : null
    return { login: raw.login, name: text('name'), email: text('email'), id, host: account.host }
  } catch {
    return null
  } finally {
    release()
  }
}
