import { describe, expect, it } from 'vitest'
import type {
  AgentPermissionPolicy,
  BypassRemovalCategory
} from '../../shared/agent-permission-policy'
import { decideBypassPermission } from './bypass-permission-decision'

const payload = (overrides: Record<string, unknown> = {}) => ({
  session_id: 's',
  cwd: '/repo/app',
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf $BUILD', description: 'clean' },
  permission_suggestions: [],
  ...overrides
})
const catalog = (...categories: BypassRemovalCategory[]): AgentPermissionPolicy => ({
  mode: 'catalog',
  categories
})
const decide = (policy: AgentPermissionPolicy | null, overrides: Record<string, unknown> = {}) =>
  decideBypassPermission({
    source: 'claude',
    payload: payload(overrides),
    policy,
    homeDir: '/home/me'
  })

describe('decideBypassPermission', () => {
  it('allows a catalog command whose categories are all allowed', () => {
    expect(decide(catalog('variable-target'))).toEqual({
      toolName: 'Bash',
      command: 'rm -rf $BUILD',
      categories: ['variable-target'],
      policyMode: 'catalog',
      diskChecks: [],
      cwd: '/repo/app'
    })
  })

  it('returns the on-disk checks for literal targets', () => {
    expect(
      decide(catalog('working-directory'), { tool_input: { command: 'rm -rf .' } })?.diskChecks
    ).toEqual([{ kind: 'is-cwd', path: '/repo/app' }])
  })

  it('leaves the prompt to the user when any category is not allowed', () => {
    expect(
      decide(catalog('variable-target'), { tool_input: { command: 'rm -rf $A $(pwd)' } })
    ).toBeNull()
    expect(decide(catalog('working-directory'))).toBeNull()
    expect(decide(catalog())).toBeNull()
  })

  it('leaves unrecognized commands and other tools to the user under a catalog', () => {
    expect(
      decide(catalog('variable-target'), { tool_input: { command: 'sudo rm -rf $X' } })
    ).toBeNull()
    expect(decide(catalog('variable-target'), { tool_name: 'Write' })).toBeNull()
    expect(decide(catalog('variable-target'), { tool_input: {} })).toBeNull()
    expect(decide(catalog('variable-target'), { cwd: undefined })).toBeNull()
  })

  it('allows every bypass-mode Bash prompt under approve-all, and nothing else', () => {
    const all: AgentPermissionPolicy = { mode: 'approve-all' }
    expect(decide(all, { tool_input: { command: 'sudo rm -rf /' } })).toMatchObject({
      categories: null,
      policyMode: 'approve-all'
    })
    expect(decide(all, { tool_name: 'Write', tool_input: { file_path: '/x' } })).toBeNull()
    expect(decide(all, { tool_name: 'Edit', tool_input: { command: 'rm -rf $X' } })).toBeNull()
    expect(decide(all, { tool_input: {} })).toBeNull()
  })

  it('only answers bypass-mode PermissionRequest events from the Claude route with a policy', () => {
    const all: AgentPermissionPolicy = { mode: 'approve-all' }
    expect(decide(null)).toBeNull()
    expect(decide(all, { permission_mode: 'default' })).toBeNull()
    expect(decide(all, { permission_mode: undefined })).toBeNull()
    expect(decide(all, { hook_event_name: 'PreToolUse' })).toBeNull()
    expect(decideBypassPermission({ source: 'codex', payload: payload(), policy: all })).toBeNull()
    expect(decideBypassPermission({ source: 'claude', payload: 'x', policy: all })).toBeNull()
  })
})
