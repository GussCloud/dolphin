import { connect } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import {
  createAgentTeamsPipeEndpoint,
  handleAgentTeamsPipeMessage,
  parseAgentTeamsPipeRequest,
  startAgentTeamsPipeListener,
  type AgentTeamsTmuxCompatHandler
} from './claude-agent-teams-pipe-listener'
import { ClaudeAgentTeamsService, type AgentTeamsTerminalApi } from './claude-agent-teams-service'

const ENDPOINT_PATTERN = /^\\\\\.\\pipe\\dolphin-agent-teams-[0-9]+-[0-9a-f]{32}$/

function request(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    v: 1,
    id: 'req-1',
    teamId: 'team-1',
    token: 'secret',
    envPane: '%1',
    cwd: 'C:\\work',
    argv: ['display-message', '-p', '#{pane_id}'],
    ...overrides
  })
}

function teamHandler(): { teamId: string; token: string; handle: AgentTeamsTmuxCompatHandler } {
  const service = new ClaudeAgentTeamsService('win32')
  const launch = service.createLaunchEnv({
    leaderHandle: 'leader',
    baseEnv: { Path: 'C:\\Windows' },
    shimDir: 'C:\\shim',
    shimBin: 'C:\\dolphin.exe'
  })
  const unused = async (): Promise<never> => {
    throw new Error('terminal API not expected')
  }
  const api: AgentTeamsTerminalApi = {
    splitTerminal: unused,
    resolveHostShell: () => null,
    readTerminal: unused,
    sendTerminal: unused,
    focusTerminal: unused,
    closeTerminal: unused,
    showTerminal: unused
  }
  return {
    teamId: launch.teamId,
    token: launch.token,
    handle: (req) => service.handleTmuxCompat(req, api)
  }
}

describe('agent teams pipe request parsing', () => {
  it('accepts exactly the tmux compat shape', () => {
    expect(parseAgentTeamsPipeRequest(request())).toEqual({
      ok: true,
      id: 'req-1',
      request: {
        teamId: 'team-1',
        token: 'secret',
        envPane: '%1',
        cwd: 'C:\\work',
        argv: ['display-message', '-p', '#{pane_id}']
      }
    })
  })

  it.each([
    ['an RPC method envelope', request({ method: 'terminal.list' })],
    ['a master auth token', request({ authToken: 'master' })],
    ['a non-string argv entry', request({ argv: ['list-panes', 1] })],
    ['a missing token', request({ token: '' })],
    ['a missing pane', request({ envPane: undefined })],
    ['a non-string cwd', request({ cwd: 3 })],
    ['a JSON array', '[]'],
    ['malformed JSON', '{"v":1'],
    ['an oversized frame', '']
  ])('rejects %s', async (_label, raw) => {
    const handle = vi.fn()
    const response = await handleAgentTeamsPipeMessage(raw, handle)
    expect(handle).not.toHaveBeenCalled()
    expect(response).toMatchObject({ v: 1, stdout: '', exitCode: 1 })
    expect(response.stderr).toBe('tmux: invalid request\n')
  })

  it('answers an unknown protocol version with an error instead of dropping it', async () => {
    const handle = vi.fn()
    const response = await handleAgentTeamsPipeMessage(request({ v: 2 }), handle)
    expect(handle).not.toHaveBeenCalled()
    expect(response).toEqual({
      v: 1,
      id: 'req-1',
      stdout: '',
      stderr: 'tmux: unsupported agent teams pipe protocol version\n',
      exitCode: 1
    })
  })

  it('refuses a wrong team token through the service', async () => {
    const team = teamHandler()
    for (const token of ['wrong', `${team.token}x`, team.token.slice(0, -1)]) {
      const response = await handleAgentTeamsPipeMessage(
        request({ teamId: team.teamId, token, argv: ['-V'] }),
        team.handle
      )
      expect(response.exitCode).toBe(1)
      expect(response.stderr).toBe('tmux: stale or unauthorized agent team\n')
    }
  })

  it('reports a handler throw as a tmux error', async () => {
    const response = await handleAgentTeamsPipeMessage(request(), async () => {
      throw new Error('boom')
    })
    expect(response).toMatchObject({ id: 'req-1', stderr: 'tmux: boom\n', exitCode: 1 })
  })

  it('mints an unguessable endpoint in the shape tmux.exe accepts', () => {
    const first = createAgentTeamsPipeEndpoint(4242)
    expect(first).toMatch(ENDPOINT_PATTERN)
    expect(first).toContain('-4242-')
    expect(createAgentTeamsPipeEndpoint(4242)).not.toBe(first)
  })
})

describe.runIf(process.platform === 'win32')('agent teams pipe listener', () => {
  it('serves one tmux call per line over the named pipe', async () => {
    const team = teamHandler()
    const { transport, endpoint } = await startAgentTeamsPipeListener({
      pid: process.pid,
      handle: team.handle
    })
    try {
      const reply = await new Promise<string>((resolve, reject) => {
        const socket = connect(endpoint)
        let buffer = ''
        socket.setEncoding('utf8')
        socket.on('error', reject)
        socket.on('data', (chunk: string) => {
          buffer += chunk
          if (buffer.includes('\n')) {
            socket.end()
            resolve(buffer.trim())
          }
        })
        socket.write(
          `${request({ teamId: team.teamId, token: team.token, argv: ['display-message', '-p', '#{pane_id}'] })}\n`
        )
      })
      expect(JSON.parse(reply)).toEqual({
        v: 1,
        id: 'req-1',
        stdout: '%1\n',
        stderr: '',
        exitCode: 0
      })
    } finally {
      await transport.stop()
    }
  })
})
