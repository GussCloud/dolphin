import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CLAUDE_PROFILE_MARKER } from '../claude-accounts/pinned-config-dir/claude-pinned-config-layout'
import { registerClaudeProfileRootSources } from '../claude-accounts/profile/claude-profile-roots'
import { localAiVaultScanRoots } from './cached-session-list'
import { validateAiVaultSessionDeleteTarget } from './session-delete-target'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots, jsonLines } from './session-scanner-test-fixtures'

// API-key sessions run Claude Code in an API account's profile; the vault lists them as
// `claude-api` and never as Claude, so each transcript belongs to exactly one agent.

let tempRoots: string[] = []

afterEach(async () => {
  registerClaudeProfileRootSources({
    managedAccountsRoot: () => null,
    linkedConfigDirs: () => [],
    apiKeyAccountIds: () => [],
    planAccountIds: () => []
  })
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

async function writeTranscript(projectsDir: string, sessionId: string, iso: string) {
  const dir = join(projectsDir, '-repo')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${sessionId}.jsonl`)
  await writeFile(
    filePath,
    `${jsonLines([
      {
        type: 'user',
        sessionId,
        timestamp: iso,
        cwd: '/repo',
        message: { role: 'user', content: `prompt for ${sessionId}` }
      },
      {
        type: 'assistant',
        sessionId,
        timestamp: iso,
        message: { role: 'assistant', model: 'claude-sonnet-4-5', content: 'ok' }
      }
    ])}\n`
  )
  const time = new Date(iso)
  await utimes(filePath, time, time)
  return filePath
}

async function accountProfiles(root: string) {
  const accountsRoot = join(root, 'claude-accounts')
  for (const id of ['plan-1', 'api-1']) {
    await mkdir(join(accountsRoot, id, 'config'), { recursive: true })
    await writeFile(join(accountsRoot, id, 'config', CLAUDE_PROFILE_MARKER), '{"version":1}\n')
  }
  registerClaudeProfileRootSources({
    managedAccountsRoot: () => accountsRoot,
    linkedConfigDirs: () => [],
    apiKeyAccountIds: () => ['api-1'],
    planAccountIds: () => ['plan-1']
  })
  return {
    planProjects: join(accountsRoot, 'plan-1', 'config', 'projects'),
    apiProjects: join(accountsRoot, 'api-1', 'config', 'projects')
  }
}

describe('API-key sessions in the AI Vault', () => {
  it('scans API profiles only as claude-api, and the Claude source no longer reads them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dolphin-ai-vault-claude-api-'))
    tempRoots.push(root)
    const { planProjects, apiProjects } = await accountProfiles(root)
    const planFile = await writeTranscript(planProjects, 'plan-session', '2026-05-01T10:00:00.000Z')
    const apiFile = await writeTranscript(apiProjects, 'api-session', '2026-05-01T11:00:00.000Z')

    const scanRoots = await localAiVaultScanRoots()
    expect(scanRoots.additionalClaudeProjectsDirs).toEqual([planProjects])
    expect(scanRoots.claudeApiProjectsDirs).toEqual([apiProjects])

    const result = await scanAiVaultSessions({
      ...isolatedScanRoots(root),
      ...scanRoots,
      platform: 'darwin',
      limit: 20
    })

    const rowsByPath = new Map<string, string[]>()
    for (const session of result.sessions) {
      rowsByPath.set(session.filePath, [...(rowsByPath.get(session.filePath) ?? []), session.agent])
    }
    expect(rowsByPath.get(apiFile)).toEqual(['claude-api'])
    expect(rowsByPath.get(planFile)).toEqual(['claude'])
    // A bare `claude --resume` would run on the plan login, so no copyable line is published.
    expect(result.sessions.find((session) => session.filePath === apiFile)?.resumeCommand).toBe('')
  })
})

describe('API-key session delete', () => {
  const accountsRoot = resolve('/tmp', 'dolphin-ai-vault-claude-api-delete', 'claude-accounts')
  const apiRoot = join(accountsRoot, 'api-1', 'config', 'projects')
  const planRoot = join(accountsRoot, 'plan-1', 'config', 'projects')
  const rootOptions = {
    claudeProjectsDir: resolve('/tmp', 'dolphin-ai-vault-claude-api-delete', '.claude', 'projects'),
    additionalClaudeProjectsDirs: [planRoot],
    claudeApiProjectsDirs: [apiRoot]
  }

  it('deletes an API transcript with its companions inside the API profile', () => {
    const filePath = join(apiRoot, '-repo', 'abc.jsonl')
    expect(
      validateAiVaultSessionDeleteTarget({
        agent: 'claude-api',
        filePath,
        executionHostId: 'local',
        rootOptions
      })
    ).toMatchObject({
      allowed: true,
      agent: 'claude-api',
      removals: [
        { path: join(apiRoot, '-repo', 'abc'), kind: 'directory' },
        { path: join(accountsRoot, 'api-1', 'config', 'session-env', 'abc'), kind: 'directory' },
        { path: filePath, kind: 'file' }
      ]
    })
  })

  it('refuses a path from the other agent root in either direction', () => {
    expect(
      validateAiVaultSessionDeleteTarget({
        agent: 'claude',
        filePath: join(apiRoot, '-repo', 'abc.jsonl'),
        executionHostId: 'local',
        rootOptions
      })
    ).toMatchObject({ allowed: false, reason: 'path-outside-known-roots' })
    expect(
      validateAiVaultSessionDeleteTarget({
        agent: 'claude-api',
        filePath: join(planRoot, '-repo', 'abc.jsonl'),
        executionHostId: 'local',
        rootOptions
      })
    ).toMatchObject({ allowed: false, reason: 'path-outside-known-roots' })
  })
})
