import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import { runProcess } from '../../shared/child-process/run-process'

// Runs real git through the "Default sign-in" helper with a fake `az` and a fake fallback helper.

const mocks = vi.hoisted(() => ({ readReachableUrls: vi.fn() }))

vi.mock('../git/command-runner/repo-git-account-env', () => ({
  readReachableUrls: mocks.readReachableUrls
}))
vi.mock('../github/gh-terminal-config-dir', () => ({
  detectGhTokenStorage: vi.fn(),
  ensureGhTerminalConfigDir: vi.fn()
}))
vi.mock('../azure-devops/azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: 'azure-cli', autoRenewCliSession: true })
}))

import { buildTerminalGitAccountEnv } from './terminal-git-account-env'

const REMOTE = 'https://evup@dev.azure.com/evup/P/_git/app'

const repo: Repo = {
  id: 'r1',
  path: '/work/app',
  displayName: 'app',
  badgeColor: '#000',
  addedAt: 0,
  kind: 'git'
}

let home: string
let bin: string

async function writeScript(path: string, body: string): Promise<void> {
  await writeFile(path, `#!/bin/sh\n${body}\n`)
  await chmod(path, 0o755)
}

async function fill(azMode: 'token' | 'lapsed' | 'absent'): Promise<{
  code: number | null
  stdout: string
  stderr: string
}> {
  const patch = await buildTerminalGitAccountEnv({ repo, cwd: home })
  const result = await runProcess({
    program: 'git',
    args: ['credential', 'fill'],
    cwd: home,
    input: `url=${REMOTE}\n\n`,
    env: {
      PATH: azMode === 'absent' ? (process.env.PATH ?? '') : `${bin}:${process.env.PATH ?? ''}`,
      HOME: home,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      FAKE_AZ_MODE: azMode,
      GIT_CONFIG_PARAMETERS: patch?.env.GIT_CONFIG_PARAMETERS ?? ''
    },
    timeoutMs: 20_000
  })
  return { code: result.code, stdout: result.stdout, stderr: result.stderr }
}

describe.skipIf(process.platform === 'win32')('"Default sign-in" helper under real git', () => {
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'dolphin-default-az-'))
    bin = join(home, 'bin')
    await mkdir(bin)
    await writeScript(
      join(bin, 'az'),
      [
        'case "$1 $2" in',
        '  "account get-access-token") [ "$FAKE_AZ_MODE" = token ] && { echo az-token; exit 0; }',
        '    echo "AADSTS70043: The refresh token has expired" >&2; exit 1;;',
        '  "account show") exit 0;;',
        'esac',
        'exit 2'
      ].join('\n')
    )
    // Stands in for GCM/osxkeychain: the user's own helper that must answer only without az.
    const fallback = join(home, 'fallback-helper')
    await writeScript(
      fallback,
      'test "$1" = get || exit 0; cat >/dev/null; echo username=gcm; echo password=gcm-token'
    )
    await writeFile(join(home, '.gitconfig'), `[credential]\n\thelper = ${fallback}\n`)
    mocks.readReachableUrls.mockReset().mockResolvedValue([REMOTE])
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true })
  })

  it('answers with the az token and never asks the fallback helper', async () => {
    const result = await fill('token')
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('username=dolphin')
    expect(result.stdout).toContain('password=az-token')
  })

  it('stops with a renewal hint when the signed-in az cannot issue a token', async () => {
    const result = await fill('lapsed')
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('Azure CLI could not issue an Azure DevOps token')
    expect(result.stdout).not.toContain('gcm-token')
  })

  it("hands the request to git's own helper when az is not installed", async () => {
    const result = await fill('absent')
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('password=gcm-token')
  })
})
