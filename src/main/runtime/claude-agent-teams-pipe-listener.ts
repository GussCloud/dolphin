import { randomBytes } from 'node:crypto'
import { UnixSocketTransport } from './rpc/unix-socket-transport'
import type {
  AgentTeamsTmuxCompatRequest,
  AgentTeamsTmuxCompatResponse
} from './claude-agent-teams-types'

// Why a dedicated pipe: tmux.exe talks to it directly, skipping the ~360ms Electron-as-Node CLI hop
// per call. It serves only tmux compat requests and authenticates with the team token alone.
export const AGENT_TEAMS_PIPE_PROTOCOL_VERSION = 1
const REQUEST_KEYS = new Set(['v', 'id', 'teamId', 'token', 'envPane', 'cwd', 'argv'])
const MAX_REQUEST_ID_LENGTH = 128

export type AgentTeamsTmuxCompatHandler = (
  request: AgentTeamsTmuxCompatRequest
) => Promise<AgentTeamsTmuxCompatResponse>

export type AgentTeamsPipeResponse = {
  v: typeof AGENT_TEAMS_PIPE_PROTOCOL_VERSION
  id: string
  stdout: string
  stderr: string
  exitCode: number
}

type ParsedPipeRequest =
  | { ok: true; id: string; request: AgentTeamsTmuxCompatRequest }
  | { ok: false; id: string; message: string }

/** Unguessable per-launch pipe name; tmux.exe validates this exact shape before connecting. */
export function createAgentTeamsPipeEndpoint(pid: number): string {
  return `\\\\.\\pipe\\dolphin-agent-teams-${pid}-${randomBytes(16).toString('hex')}`
}

export function parseAgentTeamsPipeRequest(raw: string): ParsedPipeRequest {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false, id: 'unknown', message: 'invalid request' }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, id: 'unknown', message: 'invalid request' }
  }
  const record = new Map(Object.entries(value))
  const rawId = record.get('id')
  const id =
    typeof rawId === 'string' && rawId.length > 0 && rawId.length <= MAX_REQUEST_ID_LENGTH
      ? rawId
      : 'unknown'
  // Why: answered, not dropped — the shim must not mistake a version skew for a dead pipe and retry.
  if (record.get('v') !== AGENT_TEAMS_PIPE_PROTOCOL_VERSION) {
    return { ok: false, id, message: 'unsupported agent teams pipe protocol version' }
  }
  const teamId = record.get('teamId')
  const token = record.get('token')
  const envPane = record.get('envPane')
  const cwd = record.get('cwd')
  const argv = record.get('argv')
  if (
    id === 'unknown' ||
    [...record.keys()].some((key) => !REQUEST_KEYS.has(key)) ||
    !isNonEmptyString(teamId) ||
    !isNonEmptyString(token) ||
    !isNonEmptyString(envPane) ||
    (cwd !== undefined && typeof cwd !== 'string') ||
    !Array.isArray(argv) ||
    !argv.every((arg): arg is string => typeof arg === 'string')
  ) {
    return { ok: false, id, message: 'invalid request' }
  }
  return {
    ok: true,
    id,
    request: { teamId, token, envPane, argv, ...(cwd !== undefined ? { cwd } : {}) }
  }
}

export async function handleAgentTeamsPipeMessage(
  raw: string,
  handle: AgentTeamsTmuxCompatHandler
): Promise<AgentTeamsPipeResponse> {
  const parsed = parseAgentTeamsPipeRequest(raw)
  if (!parsed.ok) {
    return failure(parsed.id, parsed.message)
  }
  try {
    const result = await handle(parsed.request)
    return {
      v: AGENT_TEAMS_PIPE_PROTOCOL_VERSION,
      id: parsed.id,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    }
  } catch (error) {
    return failure(parsed.id, error instanceof Error ? error.message : String(error))
  }
}

export async function startAgentTeamsPipeListener(args: {
  pid: number
  handle: AgentTeamsTmuxCompatHandler
  endpoint?: string
}): Promise<{ transport: UnixSocketTransport; endpoint: string }> {
  const endpoint = args.endpoint ?? createAgentTeamsPipeEndpoint(args.pid)
  const transport = new UnixSocketTransport({ endpoint, kind: 'named-pipe' })
  transport.onMessage((msg, reply) => {
    void handleAgentTeamsPipeMessage(msg, args.handle).then((response) =>
      reply(JSON.stringify(response))
    )
  })
  await transport.start()
  return { transport, endpoint }
}

function failure(id: string, message: string): AgentTeamsPipeResponse {
  return {
    v: AGENT_TEAMS_PIPE_PROTOCOL_VERSION,
    id,
    stdout: '',
    stderr: `tmux: ${message}\n`,
    exitCode: 1
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
