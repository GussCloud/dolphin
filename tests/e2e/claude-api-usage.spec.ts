import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

const FAKE_KEY = 'sk-ant-test-fake'

function assistantTurn(sessionId: string): string {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    timestamp: new Date().toISOString(),
    cwd: '/workspace/api-repo',
    message: {
      id: `msg-${sessionId}`,
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 1_000, output_tokens: 500 }
    }
  })
}

test.describe('Claude (API) usage', () => {
  test('reports API account usage in its own Stats tab with a list-price cost, never in Claude', async ({
    electronApp,
    appPage
  }) => {
    await waitForSessionReady(appPage)
    if (process.platform === 'linux') {
      // Why: Linux CI has no keyring; this test-only switch gives safeStorage an in-memory key.
      await electronApp.evaluate(({ safeStorage }) => safeStorage.setUsePlainTextEncryption(true))
    }
    const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    await appPage.evaluate(() => window.__store?.getState().updateSettings({ uiLanguage: 'en' }))

    const accountId = await appPage.evaluate(async (apiKey) => {
      const state = await window.api.claudeAccounts.addApiKeyAccount({ label: 'Usage API', apiKey })
      return state.accounts.find((account) => account.authMethod === 'api-key')?.id ?? null
    }, FAKE_KEY)
    expect(accountId).toBeTruthy()
    const projectDir = path.join(
      userData,
      'claude-accounts',
      accountId ?? '',
      'config',
      'projects',
      'api-repo'
    )
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(path.join(projectDir, 'api-session.jsonl'), `${assistantTurn('api-session')}\n`)

    // The subscription scan runs on the same worker over an isolated home: it must find nothing.
    const claudeSummary = await appPage.evaluate(async () => {
      await window.api.claudeUsage.setEnabled({ enabled: true })
      await window.api.claudeUsage.refresh({ force: true })
      return window.api.claudeUsage.getSummary({ scope: 'all', range: '30d' })
    })
    expect(claudeSummary.inputTokens).toBe(0)

    await appPage.evaluate(async () => {
      const state = window.__store!.getState()
      await state.setClaudeApiUsageScope('all')
      await state.enableClaudeApiUsage()
      state.openSettingsPage()
    })
    await appPage.getByRole('button', { name: 'Stats & Usage' }).click()
    const providerDropdown = appPage.getByTestId('usage-provider-select')
    await providerDropdown.click()
    await appPage.getByRole('menuitem', { name: 'Claude (API)', exact: true }).click()
    await expect(
      appPage.getByRole('heading', { name: 'Claude (API) Usage Tracking' })
    ).toBeVisible()

    const costLabel = appPage.getByText('Est. cost (list prices)', { exact: true })
    await expect(costLabel).toBeVisible({ timeout: 30_000 })
    await expect(costLabel.locator('xpath=preceding-sibling::p[1]')).toHaveText(/^\$\d/, {
      timeout: 30_000
    })

    await appPage.evaluate(
      (id) => window.api.claudeAccounts.remove({ accountId: id }),
      accountId ?? ''
    )
  })
})
