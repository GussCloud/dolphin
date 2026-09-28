import { test, expect } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  sendToTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager,
  waitForTerminalOutput
} from './helpers/terminal'
import {
  stageNodeScriptForTerminal,
  type StagedTerminalNodeScript
} from './helpers/run-node-script-in-terminal'
import { worktreeRow } from './worktree-row-locators'

test('Pi EOF removes the completed agent row from the live Electron sidebar (#12907)', async ({
  dolphinPage
}, testInfo) => {
  await waitForSessionReady(dolphinPage)
  const worktreeId = await waitForActiveWorktree(dolphinPage)
  await ensureTerminalVisible(dolphinPage)
  await waitForActiveTerminalManager(dolphinPage)
  const ptyId = await waitForActivePanePtyId(dolphinPage)
  await dolphinPage.evaluate(() => {
    const state = window.__store?.getState()
    if (!state) {
      throw new Error('window.__store is unavailable')
    }
    state.setAgentActivityDisplayMode('full')
    if (!state.worktreeCardProperties.includes('inline-agents')) {
      state.toggleWorktreeCardProperty('inline-agents')
    }
  })

  const script: StagedTerminalNodeScript = stageNodeScriptForTerminal(
    "process.stdout.write('PI_EOF_AGENT_READY\\r\\n\\x1b]0;Pi\\x07'); process.stdin.resume(); process.stdin.on('end', () => process.exit(0))"
  )
  // Keep the shell from becoming the surviving process after the child accepts
  // EOF. The queued `exit` runs after node exits, on POSIX shells used here.
  await sendToTerminal(dolphinPage, ptyId, `${script.command}; exit\r`)
  try {
    await waitForTerminalOutput(dolphinPage, 'PI_EOF_AGENT_READY', 15_000)
    const agentRows = worktreeRow(dolphinPage, worktreeId).locator('[aria-label="Agents"] > div')
    await expect(agentRows).toHaveCount(1)
    await dolphinPage.screenshot({ path: testInfo.outputPath('pi-row-before-eof.png') })

    await sendToTerminal(dolphinPage, ptyId, '\u0004')
    await expect(agentRows).toHaveCount(0, { timeout: 15_000 })
    await dolphinPage.screenshot({ path: testInfo.outputPath('pi-row-after-eof.png') })
  } finally {
    script.cleanup()
  }
})
