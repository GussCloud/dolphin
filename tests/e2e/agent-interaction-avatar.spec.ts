import { test, expect } from './helpers/dolphin-app'
import type { ElectronApplication, Page } from '@playwright/test'
import {
  sendToTerminal,
  waitForActivePaneHookDescriptor,
  waitForActivePanePtyId,
  waitForActiveTerminalManager,
  waitForTerminalOutput
} from './helpers/terminal'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { emitCodexHookStatus, readHookEndpoint } from './helpers/agent-hook-endpoint'

// Why: assertions match English copy; the runner's OS locale would otherwise pick the language.
async function useEnglishUi(appPage: Page): Promise<void> {
  await appPage.evaluate(() => window.__store?.getState().updateSettings({ uiLanguage: 'en' }))
}

// Why: a focused window showing the agent's workspace suppresses its cue by design, and CI
// windows can hold focus; Settings puts no workspace on screen.
async function showSettingsPage(appPage: Page): Promise<void> {
  await appPage.evaluate(() => window.__store?.getState().openSettingsPage())
}

function findAvatarPage(electronApp: ElectronApplication): Page | undefined {
  return electronApp.windows().find((page) => page.url().includes('agent-avatar.html'))
}

test.describe('Agent interaction avatar', () => {
  test('the Agent Integration settings page turns the feature on', async ({
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    await useEnglishUi(appPage)
    await appPage.evaluate(() => {
      const state = window.__store?.getState()
      state?.openSettingsTarget({ pane: 'agent-integration', repoId: null })
      state?.openSettingsPage()
    })
    const masterSwitch = appPage.getByRole('switch', { name: 'Enable Agent Integration' })
    await expect(masterSwitch).toBeVisible({ timeout: 30_000 })
    await expect(appPage.getByRole('switch', { name: 'Task finished' })).toBeDisabled()
    await appPage.screenshot({ path: testInfo.outputPath('agent-integration-settings.png') })

    await masterSwitch.click()
    await expect
      .poll(() => appPage.evaluate(async () => (await window.api.settings.get()).agentInteraction))
      .toMatchObject({ enabled: true })
    await expect(appPage.getByRole('switch', { name: 'Task finished' })).toBeEnabled()
    await appPage.evaluate(() => window.__store?.getState().closeSettingsPage())
  })

  test('a finished agent turn raises the floating avatar, and opening it dismisses it', async ({
    appPage,
    electronApp
  }, testInfo) => {
    await waitForSessionReady(appPage)
    await waitForActiveWorktree(appPage)
    await ensureTerminalVisible(appPage)
    await waitForActiveTerminalManager(appPage, 30_000)
    await useEnglishUi(appPage)
    await appPage.evaluate(() => window.api.settings.set({ agentInteraction: { enabled: true } }))
    const endpoint = await readHookEndpoint(electronApp)

    // Why: the synthetic hook bypasses the shell; a responsive PTY proves the pane is live.
    const ptyId = await waitForActivePanePtyId(appPage)
    const readyMarker = `__AGENT_AVATAR_READY_${Date.now()}__`
    await sendToTerminal(appPage, ptyId, `printf '${readyMarker}\\n'\r`)
    await waitForTerminalOutput(appPage, readyMarker)

    const { paneKey, worktreeId } = await waitForActivePaneHookDescriptor(appPage)
    const prompt = `agent-avatar-${Date.now()}`
    await showSettingsPage(appPage)
    await emitCodexHookStatus(endpoint, { paneKey, worktreeId, state: 'working', prompt })
    await emitCodexHookStatus(endpoint, {
      paneKey,
      worktreeId,
      state: 'done',
      prompt,
      lastAssistantMessage: 'done'
    })

    await expect
      .poll(() => Boolean(findAvatarPage(electronApp)), {
        timeout: 30_000,
        message: 'Agent Stop hook did not create the avatar window'
      })
      .toBe(true)
    const avatarPage = findAvatarPage(electronApp)!
    const card = avatarPage.getByRole('button', { name: /^Task finished/ })
    await expect(card).toBeVisible()
    await avatarPage.screenshot({ path: testInfo.outputPath('agent-avatar.png') })

    await card.click()
    await expect(card).toHaveCount(0)

    // A second turn raises it again; opening its workspace in the main window answers it.
    await showSettingsPage(appPage)
    await emitCodexHookStatus(endpoint, { paneKey, worktreeId, state: 'working', prompt })
    await emitCodexHookStatus(endpoint, {
      paneKey,
      worktreeId,
      state: 'done',
      prompt,
      lastAssistantMessage: 'done again'
    })
    await expect(card).toBeVisible({ timeout: 30_000 })
    // Why direct: a background launch never holds OS focus, so the auto-ack scan reports
    // nothing on screen; this is the report it sends when the user opens the workspace.
    await appPage.evaluate(
      (id) => window.api.agentInteractionAvatar.reportViewedWorktrees([id]),
      worktreeId
    )
    await expect(card).toHaveCount(0)
    await appPage.evaluate(() => window.__store?.getState().closeSettingsPage())
  })
})
