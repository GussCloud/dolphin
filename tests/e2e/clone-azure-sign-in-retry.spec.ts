import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { openSidebarProjectDialog } from './helpers/sidebar-project-dialog'
import { waitForSessionReady } from './helpers/store'

// Why stubbed IPC: CI has no Azure DevOps org or az login; the git side is unit-tested in main.
const AZURE_URL = 'https://dev.azure.com/e2e-org/Project/_git/app'
const SIGN_IN_FAILURE =
  'Clone failed: Azure DevOps did not accept the sign-in for this clone. Sign in to Azure DevOps and try again. Git reported: fatal: unable to get password from user'
const RETRY_FAILURE = 'Clone failed: fatal: repository not found after sign-in'

type SignInOutcome = { ok: true } | { ok: false; error: string }

async function stubCloneAndSignIn(app: ElectronApplication, signIn: SignInOutcome): Promise<void> {
  await app.evaluate(
    ({ ipcMain }, { firstFailure, retryFailure, signInResult }) => {
      const calls: { clone: number; signIn: string[] } = { clone: 0, signIn: [] }
      Object.assign(globalThis, { __cloneAzureCalls: calls })
      ipcMain.removeHandler('repos:clone')
      ipcMain.handle('repos:clone', async () => {
        calls.clone += 1
        throw new Error(calls.clone === 1 ? firstFailure : retryFailure)
      })
      ipcMain.removeHandler('azureDevOps:startCliSignIn')
      ipcMain.handle('azureDevOps:startCliSignIn', async (_event, mode: string) => {
        calls.signIn.push(mode)
        return signInResult
      })
    },
    { firstFailure: SIGN_IN_FAILURE, retryFailure: RETRY_FAILURE, signInResult: signIn }
  )
}

// Why both: the button needs Azure CLI auth, and a later preflight refresh must keep reporting it.
async function enableAzureCliAuth(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.__store?.getState().preflightStatus?.azureDevOps))
    )
    .toBe(true)
  await page.evaluate(async () => {
    await window.api.azureDevOps.setAuthMethod('azure-cli')
    const store = window.__store
    const status = store?.getState().preflightStatus
    const azureDevOps = status?.azureDevOps
    if (!store || !status || !azureDevOps) {
      throw new Error('preflight status is not loaded')
    }
    store.setState({
      preflightStatus: { ...status, azureDevOps: { ...azureDevOps, authMethod: 'azure-cli' } }
    })
  })
}

async function readCalls(app: ElectronApplication): Promise<{ clone: number; signIn: string[] }> {
  // Why inline narrowing: evaluate serializes this function, so it cannot call a module helper.
  return app.evaluate(() => {
    const calls = '__cloneAzureCalls' in globalThis ? globalThis.__cloneAzureCalls : undefined
    if (
      typeof calls === 'object' &&
      calls !== null &&
      'clone' in calls &&
      typeof calls.clone === 'number' &&
      'signIn' in calls &&
      Array.isArray(calls.signIn)
    ) {
      return { clone: calls.clone, signIn: calls.signIn.map(String) }
    }
    return { clone: 0, signIn: [] }
  })
}

test.describe('Clone from URL: Azure DevOps sign-in', () => {
  test.use({ dolphinAppExtraEnv: { DOLPHIN_BACKGROUND_LAUNCH: '1' } })

  const scenarios: { name: string; signIn: SignInOutcome }[] = [
    { name: 'retries the clone once after the code sign-in', signIn: { ok: true } },
    {
      name: 'keeps the clone failed when the code sign-in is cancelled',
      signIn: { ok: false, error: 'cancelled' }
    }
  ]
  for (const scenario of scenarios) {
    test(scenario.name, async ({ electronApp, appPage }) => {
      await waitForSessionReady(appPage)
      await stubCloneAndSignIn(electronApp, scenario.signIn)
      await enableAzureCliAuth(appPage)
      await openSidebarProjectDialog(appPage)
      await appPage
        .getByRole('dialog', { name: /Add a project/i })
        .getByRole('button', { name: /Clone from URL/i })
        .click()

      const dialog = appPage.getByRole('dialog', { name: /Clone from URL/i })
      await dialog.getByPlaceholder('https://github.com/user/repo.git').fill(AZURE_URL)
      await dialog.getByPlaceholder('/path/to/destination').fill('/tmp/dolphin-e2e-azure-clone')
      await dialog.getByRole('button', { name: /^Clone$/ }).click()

      await expect(dialog.getByText(/did not accept the sign-in/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Sign in with a code' }).click()

      if (scenario.signIn.ok) {
        await expect(dialog.getByText(/repository not found after sign-in/)).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Sign in with a code' })).toHaveCount(0)
        expect(await readCalls(electronApp)).toEqual({ clone: 2, signIn: ['device-code'] })
      } else {
        await expect
          .poll(async () => (await readCalls(electronApp)).signIn)
          .toEqual(['device-code'])
        await expect(dialog.getByRole('button', { name: 'Sign in with a code' })).toBeEnabled()
        await expect(dialog.getByText(/Azure DevOps sign-in failed/)).toHaveCount(0)
        expect((await readCalls(electronApp)).clone).toBe(1)
      }
    })
  }
})
