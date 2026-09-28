import { expect, test } from './helpers/dolphin-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { focusActiveTerminalInput, getTerminalContent } from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

test('launches an agent TUI with a live multiline composer', async ({ appPage }) => {
  await waitForSessionReady(appPage)
  await waitForActiveWorktree(appPage)
  await ensureTerminalVisible(appPage)
  await configureGoldenStubAgent(appPage)
  await launchGoldenStubAgentFromNewTab(appPage)

  const activeTab = appPage.locator('[data-testid="sortable-tab"][data-active="true"]')
  await expect(activeTab).toHaveAttribute('data-tab-title', /Codex|Golden Stub Agent/i)

  await focusActiveTerminalInput(appPage)
  await appPage.keyboard.type('hello from e2e')
  await appPage.keyboard.press('Shift+Enter')
  await appPage.keyboard.type('second line')

  await expect
    .poll(() => getTerminalContent(appPage), { timeout: 10_000 })
    .toContain('> hello from e2e\r\n  second line')
  expect(await getTerminalContent(appPage)).not.toContain('GOLDEN_STUB_AGENT_SUBMITTED')
})
