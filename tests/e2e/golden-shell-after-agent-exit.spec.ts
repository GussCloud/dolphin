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

test('opens a clean live shell after an agent exits', async ({ appPage }) => {
  await waitForSessionReady(appPage)
  await waitForActiveWorktree(appPage)
  await ensureTerminalVisible(appPage)
  await configureGoldenStubAgent(appPage)
  await launchGoldenStubAgentFromNewTab(appPage)

  await appPage.keyboard.type('exit')
  await appPage.keyboard.press('Enter')
  await waitForTerminalOutput(appPage, GOLDEN_STUB_EXIT_MARKER, 15_000)

  const tabsBeforeShell = await appPage.locator('[data-testid="sortable-tab"]').count()
  await appPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await appPage
    .getByRole('menuitem', { name: /New Terminal/i })
    .first()
    .click({ force: true })
  await expect(appPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
  const shellPtyId = await waitForActivePanePtyId(appPage)
  // Why: a bound ptyId only means the pane exists; the renderer transport can
  // still drop keystrokes until it connects, which would strand the markers.
  expect(await waitForRestoredTerminalInputReady(appPage, shellPtyId)).toBe(true)

  const afterAgent = buildSplitMarkerEcho('after-', 'agent')
  await focusActiveTerminalInput(appPage)
  await appPage.keyboard.type(afterAgent.command)
  await appPage.keyboard.press('Enter')
  await waitForTerminalOutput(appPage, afterAgent.marker, 15_000)

  const afterShiftEnter = buildSplitMarkerEcho('after-shift-', 'enter')
  await appPage.keyboard.press('Shift+Enter')
  await appPage.keyboard.type(afterShiftEnter.command)
  await appPage.keyboard.press('Enter')
  await waitForTerminalOutput(appPage, afterShiftEnter.marker, 15_000)
  await expect(appPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
})
