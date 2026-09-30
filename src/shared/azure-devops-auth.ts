// Azure DevOps authentication domain: which credential source the host uses and
// what the Azure CLI reports about itself on that host.

export type AzureDevOpsAuthMethod = 'token' | 'azure-cli'

export const AZURE_DEVOPS_AUTH_METHODS: readonly AzureDevOpsAuthMethod[] = ['token', 'azure-cli']

export function isAzureDevOpsAuthMethod(value: unknown): value is AzureDevOpsAuthMethod {
  return value === 'token' || value === 'azure-cli'
}

// Entra ID resource id of Azure DevOps; tokens for it authorize every REST call.
export const AZURE_DEVOPS_ENTRA_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798'

export const AZURE_DEVOPS_CLI_EXTENSION_NAME = 'azure-devops'

export type AzureCliStatus = {
  installed: boolean
  devopsExtensionInstalled: boolean
  authenticated: boolean
  account: string | null
  defaultOrganization: string | null
  defaultProject: string | null
  // Epoch ms of the last Azure DevOps token the CLI issued; optional for older hosts.
  tokenExpiresAt?: number | null
}

export type AzureDevOpsAuthStatus = {
  configured: boolean
  authenticated: boolean
  account: string | null
  baseUrl: string | null
  tokenConfigured: boolean
  // Optional so remote servers that predate the Azure CLI option still parse.
  authMethod?: AzureDevOpsAuthMethod
  azureCli?: AzureCliStatus
  autoRenewCliSession?: boolean
}

export type AzureDevOpsAuthPreference = {
  method: AzureDevOpsAuthMethod
  // Re-runs `az login` in the background when the CLI can no longer issue a token.
  autoRenewCliSession: boolean
}

export type AzureDevOpsRepository = {
  name: string
  project: string
  remoteUrl: string
  sshUrl: string | null
  webUrl: string | null
  defaultBranch: string | null
}

export type AzureDevOpsRepositoriesResult =
  | { ok: true; repositories: AzureDevOpsRepository[] }
  | { ok: false; error: string }

export type AzureDevOpsConfigureDefaultsInput = {
  organization: string
  project: string | null
}

export type AzureDevOpsConfigureDefaultsResult = { ok: true } | { ok: false; error: string }

// Accepts `contoso`, `dev.azure.com/contoso` or a full URL; returns the
// organization URL `az devops` expects, or null when unusable.
export function normalizeAzureDevOpsOrganizationUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return null
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null
  }
  if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trimmed)) {
    return `https://dev.azure.com/${trimmed}`
  }
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}
