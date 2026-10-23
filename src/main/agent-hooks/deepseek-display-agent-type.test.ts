import { describe, expect, it } from 'vitest'
import { AgentHookServer } from './server'

const PANE_KEY = 'tab-deepseek:55555555-5555-4555-8555-555555555555'
const DEEPSEEK_TRANSCRIPT = '/home/me/.claude-deepseek/projects/repo/session-1.jsonl'
const CLAUDE_TRANSCRIPT = '/home/me/.claude/projects/repo/session-1.jsonl'

function hook(
  server: AgentHookServer,
  transcriptPath: string | undefined,
  payload: Record<string, unknown> = {}
): void {
  server.ingestRemote(
    {
      paneKey: PANE_KEY,
      tabId: 'tab-deepseek',
      worktreeId: 'worktree',
      ...(transcriptPath
        ? { providerSession: { key: 'session_id', id: 'session-1', transcriptPath } }
        : {}),
      payload: { state: 'working', prompt: 'ship it', agentType: 'claude', ...payload }
    },
    null
  )
}

function osc(server: AgentHookServer, payload: Record<string, unknown> = {}): void {
  server.ingestTerminalStatus({
    paneKey: PANE_KEY,
    tabId: 'tab-deepseek',
    worktreeId: 'worktree',
    connectionId: null,
    payload: { state: 'done', prompt: 'ship it', agentType: 'claude', ...payload }
  })
}

describe('the DeepSeek presentation identity the hook host stamps', () => {
  it('keeps the harness agentType and stamps displayAgentType from the transcript path', () => {
    const server = new AgentHookServer()
    hook(server, DEEPSEEK_TRANSCRIPT)
    expect(server.getStatusSnapshot()[0]).toMatchObject({
      agentType: 'claude',
      displayAgentType: 'deepseek'
    })
  })

  it('survives a later event that carries no transcript path', () => {
    const server = new AgentHookServer()
    hook(server, DEEPSEEK_TRANSCRIPT)
    osc(server)
    expect(server.getStatusSnapshot()[0]).toMatchObject({
      state: 'done',
      agentType: 'claude',
      displayAgentType: 'deepseek'
    })
  })

  it('never stamps a plain Claude row, even when the event claims DeepSeek', () => {
    const server = new AgentHookServer()
    hook(server, CLAUDE_TRANSCRIPT, { displayAgentType: 'deepseek' })
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
    osc(server, { displayAgentType: 'deepseek' })
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
  })

  it('clears when the pane moves to plain Claude or another agent', () => {
    const server = new AgentHookServer()
    hook(server, DEEPSEEK_TRANSCRIPT)
    hook(server, CLAUDE_TRANSCRIPT)
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')

    hook(server, DEEPSEEK_TRANSCRIPT, { state: 'done' })
    hook(server, undefined, { agentType: 'codex' })
    expect(server.getStatusSnapshot()[0]).toMatchObject({ agentType: 'codex' })
    expect(server.getStatusSnapshot()[0]).not.toHaveProperty('displayAgentType')
  })

  it('is persisted with the row, so a hydrated DeepSeek row is not shown as Claude', () => {
    const server = new AgentHookServer()
    hook(server, DEEPSEEK_TRANSCRIPT)
    const serialized = (
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: serializeStatusFile is the server's protected persistence writer; this reads what last-status.json receives.
      server as unknown as { serializeStatusFile(): string }
    ).serializeStatusFile()
    expect(serialized).toContain('"displayAgentType":"deepseek"')
  })
})
