import { expect, test } from './helpers/dolphin-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  GOLDEN_STUB_EXIT_MARKER,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForRestoredTerminalInputReady } from './helpers/restored-terminal-input-readiness'
import {
  focusActiveTerminalInput,
  waitForActivePanePtyId,
  waitForTerminalOutput
} from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

// Why: xterm renders the typed command itself, so `echo after-agent` would
// satisfy waitForTerminalOutput even if the shell never ran it. Splitting the
// marker keeps it out of the input, so a match proves real shell execution.
function buildSplitMarkerEcho(prefix: string, suffix: string): { command: string; marker: string } {
  const command =
    process.platform === 'win32'
      ? `Write-Output ('${prefix}' + '${suffix}')`
      : `echo "${prefix}""${suffix}"`
  return { command, marker: `${prefix}${suffix}` }
}

test('opens a clean live shell after an agent exits', async ({ dolphinPage }) => {
  await waitForSessionReady(dolphinPage)
  await waitForActiveWorktree(dolphinPage)
  await ensureTerminalVisible(dolphinPage)
  await configureGoldenStubAgent(dolphinPage)
  await launchGoldenStubAgentFromNewTab(dolphinPage)

  await dolphinPage.keyboard.type('exit')
  await dolphinPage.keyboard.press('Enter')
  await waitForTerminalOutput(dolphinPage, GOLDEN_STUB_EXIT_MARKER, 15_000)

  const tabsBeforeShell = await dolphinPage.locator('[data-testid="sortable-tab"]').count()
  await dolphinPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await dolphinPage
    .getByRole('menuitem', { name: /New Terminal/i })
    .first()
    .click({ force: true })
  await expect(dolphinPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
  const shellPtyId = await waitForActivePanePtyId(dolphinPage)
  // Why: a bound ptyId only means the pane exists; the renderer transport can
  // still drop keystrokes until it connects, which would strand the markers.
  expect(await waitForRestoredTerminalInputReady(dolphinPage, shellPtyId)).toBe(true)

  const afterAgent = buildSplitMarkerEcho('after-', 'agent')
  await focusActiveTerminalInput(dolphinPage)
  await dolphinPage.keyboard.type(afterAgent.command)
  await dolphinPage.keyboard.press('Enter')
  await waitForTerminalOutput(dolphinPage, afterAgent.marker, 15_000)

  const afterShiftEnter = buildSplitMarkerEcho('after-shift-', 'enter')
  await dolphinPage.keyboard.press('Shift+Enter')
  await dolphinPage.keyboard.type(afterShiftEnter.command)
  await dolphinPage.keyboard.press('Enter')
  await waitForTerminalOutput(dolphinPage, afterShiftEnter.marker, 15_000)
  await expect(dolphinPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
})
