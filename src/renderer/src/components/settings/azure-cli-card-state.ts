import type { AzureDevOpsAuthStatus } from '../../../../shared/azure-devops-auth'

export type AzureCliCardState =
  | 'checking'
  | 'unavailable'
  | 'not-installed'
  | 'not-authenticated'
  | 'no-access'
  | 'connected'

/** Setup step the Azure CLI card shows next, derived from the host's preflight status. */
export function deriveAzureCliCardState(
  status: AzureDevOpsAuthStatus | null | undefined,
  checking: boolean
): AzureCliCardState {
  if (checking) {
    return 'checking'
  }
  // A status without `azureCli` means the host has not applied the method switch yet
  // or predates the Azure CLI option.
  const azureCli = status?.authMethod === 'azure-cli' ? status.azureCli : undefined
  if (!azureCli) {
    return 'unavailable'
  }
  if (!azureCli.installed) {
    return 'not-installed'
  }
  if (!azureCli.authenticated) {
    return 'not-authenticated'
  }
  // Signed in, but the organization rejected the token (wrong tenant or no access).
  return status?.authenticated ? 'connected' : 'no-access'
}
