import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { openSidebarWorkspaceComposer } from './helpers/sidebar-project-dialog'
import { expect, test } from './helpers/dolphin-app'
import { createRestartSession } from './helpers/dolphin-restart'
import { waitForSessionReady } from './helpers/store'
import { runProcess } from '../../src/shared/child-process/run-process'

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

/** Each project lives in its own unrelated folder and belongs to no group. */
async function seedUnrelatedProjects(root: string): Promise<Record<string, string>> {
  const projectPaths: Record<string, string> = {}
  for (const [home, name] of [
    ['saas-home', 'saas'],
    ['crm-home', 'crm-ui'],
    ['backend-home', 'crm-api']
  ]) {
    const projectPath = path.join(root, home, name)
    mkdirSync(projectPath, { recursive: true })
    writeFileSync(path.join(projectPath, 'README.md'), `${name}\n`)
    await git(projectPath, ['init', '-b', 'main'])
    // Why: the app commits with the isolated e2e HOME, which has no git identity.
    await git(projectPath, ['config', 'user.name', 'Test'])
    await git(projectPath, ['config', 'user.email', 'test@example.com'])
    await git(projectPath, ['add', '.'])
    await git(projectPath, ['commit', '-m', 'seed'])
    projectPaths[name] = projectPath
  }
  return projectPaths
}

type MultiProjectSnapshot = {
  workspaceId: string | null
  kind: string | null
  projectGroupId: string | null | undefined
  folderPath: string | null
  memberKeys: string[]
}

async function readMultiProjectWorkspace(page: Page, name: string): Promise<MultiProjectSnapshot> {
  return page.evaluate((workspaceName) => {
    const state = window.__store!.getState()
    const workspace = state.folderWorkspaces.find((entry) => entry.name === workspaceName)
    const members = Object.values(state.workspaceLineageByChildKey).filter(
      (lineage) => lineage.parentWorkspaceKey === `folder:${workspace?.id}`
    )
    return {
      workspaceId: workspace?.id ?? null,
      kind: workspace?.kind ?? null,
      projectGroupId: workspace?.projectGroupId,
      folderPath: workspace?.folderPath ?? null,
      memberKeys: members.map((lineage) => lineage.childWorkspaceKey).sort()
    }
  }, name)
}

async function pickComposerProject(page: Page, name: string): Promise<void> {
  const dialog = page.locator('[data-slot="dialog-content"]')
  await dialog.getByRole('combobox', { name: 'Project' }).fill(name)
  await page.getByRole('option').filter({ hasText: name }).first().click()
}

test('creates a workspace from projects in unrelated folders and keeps it across a restart', async (// oxlint-disable-next-line no-empty-pattern -- this test owns both Electron launches.
{}, testInfo) => {
  test.setTimeout(300_000)
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'dolphin-multi-project-')))
  const session = createRestartSession(testInfo)
  let app: ElectronApplication | null = null
  try {
    const projectPaths = await seedUnrelatedProjects(root)
    const first = await session.launch()
    app = first.app
    const page = first.page
    await waitForSessionReady(page)
    await page.evaluate(async (paths) => {
      const store = window.__store!
      for (const projectPath of paths) {
        await store.getState().addRepoPath(projectPath)
      }
      await store.getState().awaitLocalRepoCatalogSettlement()
    }, Object.values(projectPaths))

    await openSidebarWorkspaceComposer(page)
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    await pickComposerProject(page, 'crm-ui')
    await dialog.getByRole('button', { name: 'Add another project' }).click()
    await page.getByRole('option').filter({ hasText: 'crm-api' }).first().click()
    await expect(dialog.getByRole('button', { name: 'Remove crm-api' })).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'Create multi-project workspace' })
    ).toBeVisible()
    await dialog.getByPlaceholder(/Type a name/i).fill('mp-feature')
    await page.screenshot({ path: testInfo.outputPath('1-composer.png') })
    await dialog.getByRole('button', { name: /Create multi-project workspace/ }).click()
    await expect(dialog).toBeHidden({ timeout: 60_000 })

    await expect
      .poll(async () => (await readMultiProjectWorkspace(page, 'mp-feature')).memberKeys.length, {
        timeout: 30_000
      })
      .toBe(2)
    const created = await readMultiProjectWorkspace(page, 'mp-feature')
    expect(created.kind).toBe('multi-project')
    expect(created.projectGroupId).toBeNull()
    expect(created.folderPath).toMatch(/mp-feature$/)

    const apiWorktree = path.join(created.folderPath!, 'crm-api')
    expect(await git(apiWorktree, ['branch', '--show-current'])).toMatch(/mp-feature/)
    expect(
      await git(path.join(created.folderPath!, 'crm-ui'), ['branch', '--show-current'])
    ).toMatch(/mp-feature/)

    const section = page.getByText('Multi-project workspaces', { exact: true })
    await expect(section).toBeVisible({ timeout: 30_000 })
    await expect(
      page.locator(`[role="option"][data-worktree-id="folder:${created.workspaceId}"]`)
    ).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('2-sidebar.png') })

    writeFileSync(path.join(apiWorktree, 'change.txt'), 'hello\n')
    await git(apiWorktree, ['add', 'change.txt'])
    await page.evaluate(() => {
      const state = window.__store!.getState()
      state.setRightSidebarOpen(true)
      state.setRightSidebarTab('source-control')
    })
    const members = page.getByRole('listbox', { name: 'Projects' })
    await expect(members.getByRole('option')).toHaveCount(2, { timeout: 30_000 })
    await expect(members.getByRole('option').filter({ hasText: 'crm-api' })).toContainText('1', {
      timeout: 45_000
    })
    await page.getByPlaceholder('Commit message for all projects').fill('batch commit')
    await page.getByRole('button', { name: 'Commit all' }).click()
    await expect(page.getByText(/Done in 1 of 2 projects/)).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(async () => (await git(apiWorktree, ['log', '-1', '--format=%s'])).trim(), {
        timeout: 30_000
      })
      .toBe('batch commit')
    await page.screenshot({ path: testInfo.outputPath('3-after-commit-all.png') })

    await session.close(app)
    app = null

    const second = await session.launch()
    app = second.app
    await waitForSessionReady(second.page)
    await expect
      .poll(async () => (await readMultiProjectWorkspace(second.page, 'mp-feature')).memberKeys, {
        timeout: 30_000
      })
      .toEqual(created.memberKeys)
    const restored = await readMultiProjectWorkspace(second.page, 'mp-feature')
    expect(restored).toMatchObject({ kind: 'multi-project', projectGroupId: null })
    await expect(second.page.getByText('Multi-project workspaces', { exact: true })).toBeVisible({
      timeout: 30_000
    })
    await second.page.screenshot({ path: testInfo.outputPath('4-after-restart.png') })
  } finally {
    if (app) {
      await session.close(app)
    }
    await session.dispose()
    rmSync(root, { recursive: true, force: true })
  }
})
