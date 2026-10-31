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
  // False on hosts that cannot open the `az login` browser (headless SSH). Older hosts omit it.
  autoRenewCliSessionAvailable?: boolean
}

export type AzureDevOpsAuthPreference = {
  method: AzureDevOpsAuthMethod
  // Shows the sign-in notice when the CLI can no longer issue a token; the stored name
  // predates the notice, when Dolphin ran `az login` on its own.
  autoRenewCliSession: boolean
}

// Desktop-only sign-in notice for a lapsed Azure CLI session. `az login` runs only
// after the user clicks it, never in the background.
export type AzureCliSignInState =
  | { kind: 'idle' }
  | { kind: 'required' }
  | { kind: 'signing-in'; mode: AzureCliSignInMode }
  | { kind: 'failed'; error: string }

// 'in-app' captures the sign-in URL into a Dolphin window; 'system-browser' lets `az`
// open the default browser, for tenants that block embedded sign-in.
export type AzureCliSignInMode = 'in-app' | 'system-browser'

export type AzureCliSignInResult = { ok: true } | { ok: false; error: string }

export const AZURE_CLI_SIGN_IN_STATE_CHANNEL = 'azureDevOps:cliSignInStateChanged'

export function isAzureCliSignInMode(value: unknown): value is AzureCliSignInMode {
  return value === 'in-app' || value === 'system-browser'
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
