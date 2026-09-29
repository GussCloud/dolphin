import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'

export type AzureDevOpsApi = {
  setAuthMethod: (method: AzureDevOpsAuthMethod) => Promise<AzureDevOpsAuthPreference>
  configureCliDefaults: (args: {
    organization: string
    project: string | null
  }) => Promise<AzureDevOpsConfigureDefaultsResult>
  refreshCliSession: () => Promise<void>
}
