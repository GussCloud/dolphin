import { openSidebarProjectDialog } from './helpers/sidebar-project-dialog'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

test.describe('Add project accounts panel', () => {
  test('shows this PC’s default GitHub, Azure DevOps and Claude accounts on the first screen', async ({
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    await openSidebarProjectDialog(appPage)
    const addDialog = appPage.getByRole('dialog', { name: /Add a project/i })

    await expect(addDialog.getByText('Accounts for this project')).toBeVisible()
    for (const provider of ['GitHub', 'Azure DevOps', 'Claude']) {
      await expect(addDialog.getByRole('combobox', { name: provider, exact: true })).toBeVisible()
    }
    // Why: a profile with no managed Claude account must say which login a launch would use.
    await expect(addDialog.getByRole('combobox', { name: 'Claude', exact: true })).toContainText(
      'this PC’s default'
    )
    for (const label of ['Add GitHub account', 'Add Azure DevOps account', 'Add Claude account']) {
      await expect(addDialog.getByRole('button', { name: label })).toBeVisible()
    }
    // The entry actions stay reachable under the panel.
    await expect(addDialog.getByRole('button', { name: /Clone from URL/i })).toBeVisible()

    await addDialog.screenshot({ path: testInfo.outputPath('add-project-accounts.png') })
  })
})
