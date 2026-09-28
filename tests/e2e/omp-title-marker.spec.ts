import { writeFile } from 'node:fs/promises'
import { buildShellCommandFromArgv } from '../../src/shared/tui-agent-startup-shell'
import { test, expect } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  execInTerminal,
  sendToTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'

test('OMP spaced-colon title renders working and clears on idle', async ({
  dolphinPage
}, testInfo) => {
  test.skip(
    process.platform === 'win32',
    'POSIX title replay; Windows formatter bytes have separate coverage'
  )
  await waitForSessionReady(dolphinPage)
  await waitForActiveWorktree(dolphinPage)
  await ensureTerminalVisible(dolphinPage)
  await waitForActiveTerminalManager(dolphinPage)
  const ptyId = await waitForActivePanePtyId(dolphinPage)
  const script = testInfo.outputPath('title-replay.cjs')
  await writeFile(
    script,
    `
process.stdout.write('\\x1b]0;OMP : Image review\\x07')
process.stdin.on('data', () => process.stdout.write('\\x1b]0;OMP > Image review\\x07'))
`
  )
  await execInTerminal(
    dolphinPage,
    ptyId,
    buildShellCommandFromArgv([process.execPath, script], 'posix')
  )
  const working = dolphinPage.locator('[aria-label="Working"]')
  await expect(working.first()).toBeVisible({ timeout: 15000 })
  await dolphinPage.screenshot({ path: testInfo.outputPath('omp-title-working.png') })
  await sendToTerminal(dolphinPage, ptyId, '\r')
  await expect(working).toHaveCount(0)
  await dolphinPage.screenshot({ path: testInfo.outputPath('omp-title-idle.png') })
})
