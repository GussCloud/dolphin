import { expect, test } from './helpers/dolphin-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { focusActiveTerminalInput, getTerminalContent } from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

test('launches an agent TUI with a live multiline composer', async ({ dolphinPage }) => {
  await waitForSessionReady(dolphinPage)
  await waitForActiveWorktree(dolphinPage)
  await ensureTerminalVisible(dolphinPage)
  await configureGoldenStubAgent(dolphinPage)
  await launchGoldenStubAgentFromNewTab(dolphinPage)

  const activeTab = dolphinPage.locator('[data-testid="sortable-tab"][data-active="true"]')
  await expect(activeTab).toHaveAttribute('data-tab-title', /Codex|Golden Stub Agent/i)

  await focusActiveTerminalInput(dolphinPage)
  await dolphinPage.keyboard.type('hello from e2e')
  await dolphinPage.keyboard.press('Shift+Enter')
  await dolphinPage.keyboard.type('second line')

  await expect
    .poll(() => getTerminalContent(dolphinPage), { timeout: 10_000 })
    .toContain('> hello from e2e\r\n  second line')
  expect(await getTerminalContent(dolphinPage)).not.toContain('GOLDEN_STUB_AGENT_SUBMITTED')
})
