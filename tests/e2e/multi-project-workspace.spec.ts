import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSidebarWorkspaceComposer } from './helpers/sidebar-project-dialog'
import { expect, test } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'
import { runProcess } from '../../src/shared/child-process/run-process'

test.use({ seedTestRepo: false })

const GIT_IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com']

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runProcess({
    program: 'git',
    args: [...GIT_IDENTITY, '-c', 'commit.gpgsign=false', ...args],
    cwd,
    timeoutMs: 15_000
  })
  expect(result.code, result.stderr).toBe(0)
  return result.stdout
}

test('creates one worktree per project and drives them from Source Control', async ({
  appPage,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  test.setTimeout(180_000)
  await waitForSessionReady(appPage)
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'dolphin-multi-project-')))
  registerPostElectronShutdownCleanup(async () => {
    rmSync(root, { recursive: true, force: true })
  })
  const projectPaths = ['api', 'web'].map((name) => path.join(root, name))
  for (const projectPath of projectPaths) {
    mkdirSync(projectPath)
    writeFileSync(path.join(projectPath, 'README.md'), `${path.basename(projectPath)}\n`)
    await git(projectPath, ['init', '-b', 'main'])
    // Why: the app commits with the isolated e2e HOME, which has no git identity.
    await git(projectPath, ['config', 'user.name', 'Test'])
    await git(projectPath, ['config', 'user.email', 'test@example.com'])
    await git(projectPath, ['add', '.'])
    await git(projectPath, ['commit', '-m', 'seed'])
  }

  const groupId = await appPage.evaluate(
    async ({ root, projectPaths }) => {
      const store = window.__store!
      const result = await store.getState().importNestedRepos({
        parentPath: root,
        groupName: 'MultiGroup',
        projectPaths,
        mode: 'group'
      })
      await store.getState().awaitLocalRepoCatalogSettlement()
      return result?.group?.id ?? null
    },
    { root, projectPaths }
  )
  expect(groupId).not.toBeNull()

  await openSidebarWorkspaceComposer(appPage)
  const dialog = appPage.getByRole('dialog', { name: /Create (Folder )?(Workspace|Worktree)/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Project' }).fill('MultiGroup')
  await appPage.getByRole('option').filter({ hasText: 'MultiGroup' }).first().click()
  const toggle = dialog.getByRole('checkbox', { name: 'Create a worktree in each project' })
  await expect(toggle).toBeVisible()
  await toggle.check()
  await dialog.getByPlaceholder(/Type a name/i).fill('mp-feature')
  await appPage.screenshot({ path: testInfo.outputPath('1-composer.png') })
  await dialog.getByRole('button', { name: /Create (Folder )?(Workspace|Worktree)/i }).click()
  await expect(dialog).toBeHidden({ timeout: 60_000 })

  const created = await appPage.evaluate(() => {
    const state = window.__store!.getState()
    const workspace = state.folderWorkspaces.find((entry) => entry.name === 'mp-feature')
    const members = Object.values(state.workspaceLineageByChildKey).filter(
      (lineage) => lineage.parentWorkspaceKey === `folder:${workspace?.id}`
    )
    return {
      folderPath: workspace?.folderPath ?? null,
      memberKeys: members.map((lineage) => lineage.childWorkspaceKey),
      activeWorktreeId: state.activeWorktreeId,
      workspaceId: workspace?.id ?? null
    }
  })
  expect(created.folderPath).toMatch(/mp-feature$/)
  expect(created.memberKeys).toHaveLength(2)
  expect(created.activeWorktreeId).toBe(`folder:${created.workspaceId}`)

  const apiWorktree = path.join(created.folderPath!, 'api')
  expect(await git(apiWorktree, ['branch', '--show-current'])).toMatch(/mp-feature/)
  writeFileSync(path.join(apiWorktree, 'change.txt'), 'hello\n')
  await git(apiWorktree, ['add', 'change.txt'])

  await appPage.evaluate(() => {
    const state = window.__store!.getState()
    state.setRightSidebarOpen(true)
    state.setRightSidebarTab('source-control')
  })
  const members = appPage.getByRole('listbox', { name: 'Projects' })
  await expect(members.getByRole('option')).toHaveCount(2, { timeout: 30_000 })
  await expect(members.getByRole('option').filter({ hasText: 'api' })).toContainText('1', {
    timeout: 45_000
  })
  await appPage.screenshot({ path: testInfo.outputPath('2-source-control.png') })

  await appPage.getByPlaceholder('Commit message for all projects').fill('batch commit')
  await appPage.getByRole('button', { name: 'Commit all' }).click()
  await expect(appPage.getByText(/Done in 1 of 2 projects/)).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(async () => (await git(apiWorktree, ['log', '-1', '--format=%s'])).trim(), {
      timeout: 30_000
    })
    .toBe('batch commit')
  await appPage.screenshot({ path: testInfo.outputPath('3-after-commit-all.png') })
})
