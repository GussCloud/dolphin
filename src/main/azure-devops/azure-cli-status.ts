import {
  AZURE_DEVOPS_CLI_EXTENSION_NAME,
  type AzureCliStatus,
  type AzureDevOpsConfigureDefaultsInput,
  type AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'
import {
  AzureCliCommandError,
  resolveAzureCliProgram,
  runAzureCli,
  runAzureCliJson
} from './azure-cli-runner'

const NOT_INSTALLED: AzureCliStatus = {
  installed: false,
  devopsExtensionInstalled: false,
  authenticated: false,
  account: null,
  defaultOrganization: null,
  defaultProject: null
}

async function readSignedInAccount(): Promise<{ authenticated: boolean; account: string | null }> {
  try {
    const raw = await runAzureCliJson(['account', 'show'])
    const user = raw && typeof raw === 'object' && 'user' in raw ? raw.user : null
    const name = user && typeof user === 'object' && 'name' in user ? user.name : null
    return { authenticated: true, account: typeof name === 'string' && name ? name : null }
  } catch {
    return { authenticated: false, account: null }
  }
}

async function isDevOpsExtensionInstalled(): Promise<boolean> {
  const result = await runAzureCli([
    'extension',
    'show',
    '--name',
    AZURE_DEVOPS_CLI_EXTENSION_NAME,
    '--output',
    'none'
  ])
  return result.code === 0
}

/** Parses `az devops configure --list`, an INI-style `key = value` listing. */
export function parseAzureDevOpsDefaults(stdout: string): {
  organization: string | null
  project: string | null
} {
  const values = new Map<string, string>()
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match?.[1] && match[2]) {
      values.set(match[1].toLowerCase(), match[2])
    }
  }
  return {
    organization: values.get('organization') ?? null,
    project: values.get('project') ?? null
  }
}

async function readDevOpsDefaults(): Promise<{
  organization: string | null
  project: string | null
}> {
  const result = await runAzureCli(['devops', 'configure', '--list'])
  return result.code === 0
    ? parseAzureDevOpsDefaults(result.stdout)
    : { organization: null, project: null }
}

export async function getAzureCliStatus(): Promise<AzureCliStatus> {
  if (!(await resolveAzureCliProgram())) {
    return NOT_INSTALLED
  }
  try {
    const [signedIn, devopsExtensionInstalled] = await Promise.all([
      readSignedInAccount(),
      isDevOpsExtensionInstalled()
    ])
    const defaults = devopsExtensionInstalled
      ? await readDevOpsDefaults()
      : { organization: null, project: null }
    return {
      installed: true,
      devopsExtensionInstalled,
      authenticated: signedIn.authenticated,
      account: signedIn.account,
      defaultOrganization: defaults.organization,
      defaultProject: defaults.project
    }
  } catch (error) {
    console.warn('[azure-devops] Azure CLI status probe failed', error)
    return { ...NOT_INSTALLED, installed: true }
  }
}

export async function configureAzureDevOpsDefaults(
  input: AzureDevOpsConfigureDefaultsInput
): Promise<AzureDevOpsConfigureDefaultsResult> {
  const defaults = [`organization=${input.organization}`, `project=${input.project ?? ''}`]
  try {
    const result = await runAzureCli(['devops', 'configure', '--defaults', ...defaults])
    if (result.code !== 0 || result.timedOut) {
      return { ok: false, error: new AzureCliCommandError(['devops', 'configure'], result).message }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
