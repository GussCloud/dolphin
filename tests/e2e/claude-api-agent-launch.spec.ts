import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// A fake key: the spec never touches a real one, and the fake CLI only reports whether it matched.
const FAKE_KEY = 'sk-ant-test-fake-claude-api-launch'

type ReportedEnv = {
  configDir: string
  provider: string
  accountId: string
  keyMatches: boolean
  authToken: string
  baseUrl: string
}

function appPath(electronApp: ElectronApplication, name: 'home' | 'userData'): Promise<string> {
  return electronApp.evaluate(({ app }, which) => app.getPath(which), name)
}

/** A `claude` stand-in that records the env Dolphin gave it, then exits. */
async function writeFakeClaude(dir: string, report: string): Promise<string> {
  const bin = path.join(dir, 'claude')
  await mkdir(dir, { recursive: true })
  await writeFile(
    bin,
    `#!/bin/sh
key_matches=false
[ "$ANTHROPIC_API_KEY" = "${FAKE_KEY}" ] && key_matches=true
printf '{"configDir":"%s","provider":"%s","accountId":"%s","keyMatches":%s,"authToken":"%s","baseUrl":"%s"}' \\
  "$CLAUDE_CONFIG_DIR" "$DOLPHIN_CLAUDE_PROVIDER" "$DOLPHIN_CLAUDE_API_ACCOUNT" "$key_matches" \\
  "\${ANTHROPIC_AUTH_TOKEN:+set}" "\${ANTHROPIC_BASE_URL:+set}" > ${JSON.stringify(report)}
`
  )
  await chmod(bin, 0o700)
  return bin
}

async function spawnClaudeApi(
  appPage: Page,
  args: { worktreeId: string; cwd: string; command: string }
): Promise<{ id: string } | { error: string }> {
  return appPage.evaluate(async ({ worktreeId, cwd, command }) => {
    try {
      const pane = await window.api.pty.spawn({
        cols: 100,
        rows: 30,
        cwd,
        worktreeId,
        initiallyHidden: true,
        launchAgent: 'claude-api',
        command,
        // Would bill another login or endpoint if it reached the CLI.
        env: {
          ANTHROPIC_AUTH_TOKEN: 'inherited-token',
          ANTHROPIC_BASE_URL: 'https://proxy.invalid'
        }
      })
      return { id: pane.id }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, args)
}

test.describe('Claude API agent launch', () => {
  test.skip(process.platform === 'win32', 'The fake claude CLI is a POSIX script')

  test('runs in the API account profile with its key, and refuses with no API account', async ({
    electronApp,
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    const worktreeId = await waitForActiveWorktree(appPage)
    if (process.platform === 'linux') {
      // Why: Linux CI has no keyring; this test-only switch gives safeStorage an in-memory key.
      await electronApp.evaluate(({ safeStorage }) => safeStorage.setUsePlainTextEncryption(true))
    }
    const home = await appPath(electronApp, 'home')
    const userData = await appPath(electronApp, 'userData')
    const report = testInfo.outputPath('claude-env.json')
    const fakeClaude = await writeFakeClaude(testInfo.outputPath('bin'), report)

    const refused = await spawnClaudeApi(appPage, { worktreeId, cwd: home, command: fakeClaude })
    expect(refused).toEqual({ error: expect.stringContaining('needs an API account') })

    const state = await appPage.evaluate(
      (apiKey) =>
        window.api.claudeAccounts.addApiKeyAccount({
          label: 'Work API',
          apiKey,
          copyFromAccountId: null
        }),
      FAKE_KEY
    )
    const account = state.accounts.find((entry) => entry.authMethod === 'api-key')
    expect(account).toBeTruthy()

    const launched = await spawnClaudeApi(appPage, { worktreeId, cwd: home, command: fakeClaude })
    expect(launched).toEqual({ id: expect.any(String) })
    await expect
      .poll(
        async () => {
          try {
            return JSON.parse(await readFile(report, 'utf8')) as ReportedEnv
          } catch {
            return null
          }
        },
        { timeout: 30_000 }
      )
      .toEqual({
        configDir: path.join(userData, 'claude-accounts', account!.id, 'config'),
        provider: 'anthropic-api',
        accountId: account!.id,
        keyMatches: true,
        authToken: '',
        baseUrl: ''
      })
    // The plan account plain `claude` uses is untouched by the launch.
    const activeId = await appPage.evaluate(
      async () => (await window.api.claudeAccounts.list()).activeAccountId
    )
    expect(activeId).not.toBe(account!.id)
  })
})
