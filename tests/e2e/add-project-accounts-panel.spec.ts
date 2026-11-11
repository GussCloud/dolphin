import { openSidebarProjectDialog } from './helpers/sidebar-project-dialog'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

test.describe('Add project accounts panel', () => {
  test('shows this PC’s defaults and the registered commit authors on the first screen', async ({
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
    // Why: registered authors must be visible by name and email before the project exists.
    const author = addDialog.getByRole('combobox', { name: 'Commit author' })
    await expect(author).toContainText('Git config identity (default)')
    await addDialog.getByRole('button', { name: 'New author' }).click()
    await addDialog.getByRole('textbox', { name: 'Author name' }).fill('Ana Corp')
    await addDialog.getByRole('textbox', { name: 'Author email' }).fill('ana@corp.example')
    await addDialog.getByRole('button', { name: 'Add author' }).click()
    await expect(author).toContainText('Ana Corp <ana@corp.example>')
    await expect(addDialog.getByRole('textbox', { name: 'Author email' })).toHaveValue(
      'ana@corp.example'
    )

    // The entry actions stay reachable under the panel.
    await expect(addDialog.getByRole('button', { name: /Clone from URL/i })).toBeVisible()

    await addDialog.screenshot({ path: testInfo.outputPath('add-project-accounts.png') })
  })
})
