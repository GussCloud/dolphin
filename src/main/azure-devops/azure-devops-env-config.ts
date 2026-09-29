export type AzureDevOpsAuthConfig = {
  apiBaseUrl: string | null
  pat: string | null
  accessToken: string | null
  username: string | null
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function getAzureDevOpsAuthConfig(): AzureDevOpsAuthConfig {
  return {
    apiBaseUrl: envValue('DOLPHIN_AZURE_DEVOPS_API_BASE_URL'),
    pat: envValue('DOLPHIN_AZURE_DEVOPS_TOKEN') ?? envValue('DOLPHIN_AZURE_DEVOPS_PAT'),
    accessToken: envValue('DOLPHIN_AZURE_DEVOPS_ACCESS_TOKEN'),
    username: envValue('DOLPHIN_AZURE_DEVOPS_USERNAME')
  }
}

export function azureDevOpsTokenConfigured(config: AzureDevOpsAuthConfig): boolean {
  return Boolean(config.pat || config.accessToken)
}
