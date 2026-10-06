import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult,
  AzureDevOpsRepositoriesResult
} from '../../shared/azure-devops-auth'
import type {
  AzureDevOpsOrgLinkArgs,
  AzureDevOpsOrgLinkStatus
} from '../../shared/azure-devops-org-link'

export type AzureDevOpsApi = {
  setAuthMethod: (method: AzureDevOpsAuthMethod) => Promise<AzureDevOpsAuthPreference>
  configureCliDefaults: (args: {
    organization: string
    project: string | null
  }) => Promise<AzureDevOpsConfigureDefaultsResult>
  setCliAutoRenew: (enabled: boolean) => Promise<AzureDevOpsAuthPreference>
  refreshCliSession: () => Promise<void>
  listRepositories: () => Promise<AzureDevOpsRepositoriesResult>
  orgLink: (args?: AzureDevOpsOrgLinkArgs) => Promise<AzureDevOpsOrgLinkStatus>
}
