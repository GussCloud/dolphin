import { describe, expect, it } from 'vitest'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'
import { resolveAgentAccountPickerChoices } from './agent-account-picker-choices'

function account(id: string, authMethod: ClaudeManagedAccount['authMethod']): ClaudeManagedAccount {
  return {
    id,
    email: authMethod === 'api-key' ? '' : `${id}@example.com`,
    ...(authMethod === 'api-key' ? { label: `API ${id}` } : {}),
    authMethod,
    managedAuthPath: `/managed/${id}`,
    managedAuthRuntime: 'host',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
}

const settings = {
  claudeManagedAccounts: [account('plan', 'subscription-oauth'), account('api1', 'api-key')],
  codexManagedAccounts: [],
  activeRuntimeEnvironmentId: null
}

describe('resolveAgentAccountPickerChoices for claude-api', () => {
  it('offers only API accounts, by their label', () => {
    expect(
      resolveAgentAccountPickerChoices({
        agent: 'claude-api',
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        repoPath: '/repos/a',
        settings
      })
    ).toEqual({
      agent: 'claude-api',
      choices: [{ id: 'api1', email: 'API api1', workspaceLabel: null }]
    })
  })

  it('keeps plain Claude on plan accounts only', () => {
    expect(
      resolveAgentAccountPickerChoices({
        agent: 'claude',
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        repoPath: '/repos/a',
        settings
      })?.choices.map((choice) => choice.id)
    ).toEqual(['plan'])
  })

  it('hides the picker for WSL repos and other hosts, where claude-api is refused', () => {
    for (const args of [
      {
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        repoPath: '\\\\wsl.localhost\\Ubuntu\\home\\me\\a'
      },
      { executionHostId: 'ssh:box', repoPath: '/repos/a' }
    ]) {
      expect(
        resolveAgentAccountPickerChoices({ agent: 'claude-api', settings, ...args })
      ).toBeNull()
    }
  })
})
