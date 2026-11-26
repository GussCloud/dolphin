import { isClaudeApiKeyAccount } from '../../../shared/claude-api-account'
import type { Store } from '../../persistence'
import { isDefaultClaudeConfigDir } from '../claude-account-config-dir'
import { getClaudeManagedAccountsRoot } from '../managed-auth-path'
import { registerClaudeProfileRootSources } from './claude-profile-roots'

/** Points the profile-root readers at this store's accounts (Electron main only). */
export function registerClaudeProfileRootSourcesFromStore(store: Pick<Store, 'getSettings'>): void {
  registerClaudeProfileRootSources({
    managedAccountsRoot: getClaudeManagedAccountsRoot,
    // Why default excluded: readers already scan ~/.claude as the system profile.
    linkedConfigDirs: () =>
      store
        .getSettings()
        .claudeManagedAccounts.flatMap((account) =>
          account.linkedConfigDir && !isDefaultClaudeConfigDir(account.linkedConfigDir)
            ? [account.linkedConfigDir]
            : []
        ),
    apiKeyAccountIds: () =>
      store
        .getSettings()
        .claudeManagedAccounts.filter(isClaudeApiKeyAccount)
        .map((account) => account.id)
  })
}
