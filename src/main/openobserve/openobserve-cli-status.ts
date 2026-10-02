import { z } from 'zod'
import {
  isOpenObserveAuthScheme,
  type OpenObserveAuthScheme,
  type OpenObserveCliStatus,
  type OpenObserveContext,
  type OpenObserveSkillStatus
} from '../../shared/openobserve-cli'
import {
  parseOpenObserveCliJson,
  readOpenObserveCliError,
  resolveOpenObserveCliProgram,
  runOpenObserveCli
} from './openobserve-cli-runner'

// Why shorter than the CLI's 30s default: `auth status` reaches the server, and an
// unreachable instance should not keep the settings card spinning.
const AUTH_STATUS_REQUEST_TIMEOUT = '10s'

// Why tolerant: the CLI is young and its JSON grows between releases; a field of an
// unexpected type reads as absent instead of failing the whole status.
const OptionalText = z.string().optional().catch(undefined)

const ContextItem = z.object({
  name: z.string().min(1),
  base_url: OptionalText,
  org: OptionalText,
  current: z.boolean().optional().catch(undefined)
})

const SkillInstall = z.object({
  agent: z.string().min(1),
  status: OptionalText,
  alignment: OptionalText
})

const AuthStatusOutput = z.object({
  authenticated: z.boolean().optional().catch(undefined),
  base_url: OptionalText,
  org: OptionalText,
  context: OptionalText,
  scheme: OptionalText,
  username: OptionalText,
  error: OptionalText
})

function textOrNull(value: string | undefined): string | null {
  return value ? value : null
}

/** Parses each entry of a JSON list, dropping the ones that do not match. */
function parseEach<T>(value: unknown, item: z.ZodType<T>): T[] | null {
  const list = z.array(z.unknown()).safeParse(value)
  return list.success
    ? list.data.flatMap((entry) => {
        const parsed = item.safeParse(entry)
        return parsed.success ? [parsed.data] : []
      })
    : null
}

/** Parses `config contexts`: `{items: [{name, base_url, org, current}]}`. */
export function parseOpenObserveContexts(value: unknown): OpenObserveContext[] {
  const output = z.object({ items: z.unknown() }).safeParse(value)
  const items = output.success ? parseEach(output.data.items, ContextItem) : null
  return (items ?? []).map((item) => ({
    name: item.name,
    baseUrl: textOrNull(item.base_url),
    org: textOrNull(item.org),
    current: item.current === true
  }))
}

/** Parses `skill status`: `{installs: [{agent, status, alignment}]}`. */
export function parseOpenObserveSkillStatus(value: unknown): OpenObserveSkillStatus | null {
  const output = z.object({ installs: z.unknown() }).safeParse(value)
  const installs = output.success ? parseEach(output.data.installs, SkillInstall) : null
  if (!installs) {
    return null
  }
  const installed = installs.filter((install) => install.status === 'installed')
  return {
    installedAgents: installed.map((install) => install.agent),
    outdatedAgents: installed
      .filter((install) => install.alignment === 'outdated')
      .map((install) => install.agent)
  }
}

/** First line of `version`: `openobserve-cli v0.14.0 (commit …)` → `v0.14.0`. */
export function parseOpenObserveVersion(stdout: string): string | null {
  return /\bv?\d+\.\d+\.\d+[\w.-]*/.exec(stdout)?.[0] ?? null
}

type AuthProbe = {
  // False when the CLI failed before printing its status (network, timeout).
  reported: boolean
  authenticated: boolean
  baseUrl: string | null
  org: string | null
  context: string | null
  authScheme: OpenObserveAuthScheme | null
  username: string | null
  authError: string | null
}

async function probeAuth(): Promise<AuthProbe> {
  const result = await runOpenObserveCli([
    'auth',
    'status',
    '--timeout',
    AUTH_STATUS_REQUEST_TIMEOUT
  ])
  const parsed = AuthStatusOutput.safeParse(parseOpenObserveCliJson(result))
  if (!parsed.success) {
    return {
      reported: false,
      authenticated: false,
      baseUrl: null,
      org: null,
      context: null,
      authScheme: null,
      username: null,
      authError: readOpenObserveCliError(result)
    }
  }
  const auth = parsed.data
  const authenticated = auth.authenticated === true
  return {
    reported: true,
    authenticated,
    baseUrl: textOrNull(auth.base_url),
    org: textOrNull(auth.org),
    context: textOrNull(auth.context),
    authScheme: isOpenObserveAuthScheme(auth.scheme) ? auth.scheme : null,
    username: textOrNull(auth.username),
    authError: authenticated ? null : textOrNull(auth.error)
  }
}

export async function getOpenObserveCliStatus(): Promise<OpenObserveCliStatus> {
  if (!(await resolveOpenObserveCliProgram())) {
    return { installed: false }
  }
  const [version, contexts, auth, skill] = await Promise.all([
    runOpenObserveCli(['version']),
    runOpenObserveCli(['config', 'contexts']),
    probeAuth(),
    runOpenObserveCli(['skill', 'status'])
  ])
  const parsedContexts = parseOpenObserveContexts(parseOpenObserveCliJson(contexts))
  // Why: `auth status` resolves env and .env overrides, so it wins when it answered;
  // when it failed, the saved current context still says what is configured.
  const saved = auth.reported ? null : (parsedContexts.find((context) => context.current) ?? null)
  return {
    installed: true,
    version: version.code === 0 ? parseOpenObserveVersion(version.stdout) : null,
    contexts: parsedContexts,
    activeContext: saved ? saved.name : auth.context,
    baseUrl: saved ? saved.baseUrl : auth.baseUrl,
    org: saved ? saved.org : auth.org,
    authScheme: auth.authScheme,
    authenticated: auth.authenticated,
    username: auth.username,
    authError: auth.authError,
    skill: parseOpenObserveSkillStatus(parseOpenObserveCliJson(skill))
  }
}
