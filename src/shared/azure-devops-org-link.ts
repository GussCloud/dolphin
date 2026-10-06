// Whether the Azure DevOps organization configured in this app links the signed-in
// Dolphin user to a Dolphin (corporate) organization.

export type AzureDevOpsOrgLinkStatus =
  | { status: 'connected'; organizationName: string }
  | { status: 'not-registered' }
  | { status: 'signed-out' }
  | { status: 'azure-devops-not-authenticated' }
  // Authenticated, but no Azure DevOps organization is configured to check.
  | { status: 'no-organization' }
  | { status: 'unsupported-host' }
  | { status: 'remote-host-unavailable' }
  | { status: 'error'; reason: string }

export type AzureDevOpsOrgLinkArgs = { force?: boolean }

export type AzureDevOpsLinkOrganization = {
  // Canonical URL the auth server accepts: https://dev.azure.com/{org} or https://{org}.visualstudio.com.
  organizationUrl: string
  // Lowercase `{org}`, identical for both URL forms.
  organizationName: string
}

const ORG_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

// Returns null for hosts the auth server rejects (on-prem Azure DevOps Server, other origins).
export function resolveAzureDevOpsLinkOrganization(
  baseUrl: string
): AzureDevOpsLinkOrganization | null {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (host === 'dev.azure.com') {
    const name = url.pathname.split('/').find(Boolean)?.toLowerCase() ?? ''
    return ORG_NAME_PATTERN.test(name)
      ? { organizationUrl: `https://dev.azure.com/${name}`, organizationName: name }
      : null
  }
  const legacy = /^([a-z0-9][a-z0-9-]*)\.visualstudio\.com$/.exec(host)
  if (legacy) {
    const name = legacy[1]
    return { organizationUrl: `https://${name}.visualstudio.com`, organizationName: name }
  }
  return null
}
