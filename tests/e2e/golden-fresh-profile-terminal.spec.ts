import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  focusActiveTerminalInput,
  getTerminalContent,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'

test.use({ dismissOnboarding: false, seedTestRepo: false })

async function createGitRepo(): Promise<string> {
  const root = realpathSync.native(
    await mkdtemp(path.join(os.tmpdir(), 'dolphin-e2e-golden-fresh-'))
  )
  const repoPath = path.join(root, 'golden-fresh-project')
  mkdirSync(repoPath)
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.email', 'e2e@test.local'], { cwd: repoPath })
  execFileSync('git', ['config', 'user.name', 'E2E Test'], { cwd: repoPath })
  writeFileSync(path.join(repoPath, 'README.md'), '# golden-fresh-project\n')
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath })
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath })
  return repoPath
}

async function stubFolderPicker(
  electronApp: ElectronApplication,
  selectedPath: string
): Promise<void> {
  await electronApp.evaluate(({ dialog }, folderPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folderPath],
      bookmarks: []
    })
  }, selectedPath)
}

async function selectCodexAndSkipToProject(page: Page): Promise<void> {
  const codexButton = page.getByRole('button', { name: /^Codex\s/ }).first()
  if (!(await codexButton.isVisible())) {
    await page.getByText(/Show \d+ more agents/).click()
  }
  await codexButton.click()
  const footer = page.locator('footer').filter({ has: page.getByRole('button', { name: /Skip/i }) })
  await footer.getByRole('button', { name: /^Skip to project setup$/i }).click()
  await expect(page.getByRole('dialog', { name: /Add a project/i })).toBeVisible()
}

test('fresh profile opens a live project terminal @golden', async ({
  electronApp,
  dolphinPage,
  registerPostElectronShutdownCleanup
}) => {
  await waitForSessionReady(dolphinPage)
  await expect(dolphinPage.locator('#root')).toBeVisible()
  await expect(dolphinPage.getByRole('heading', { name: /Pick your default agent/i })).toBeVisible()

  await selectCodexAndSkipToProject(dolphinPage)
  const repoPath = await createGitRepo()
  registerPostElectronShutdownCleanup(async () =>
    rmSync(path.dirname(repoPath), { recursive: true, force: true })
  )
  await stubFolderPicker(electronApp, repoPath)
  await dolphinPage
    .getByRole('button', { name: /Browse for a folder|Open a folder|Browse folder/i })
    .click()

  await expect(dolphinPage.getByText(path.basename(repoPath), { exact: true }).first()).toBeVisible(
    {
      timeout: 30_000
    }
  )
  await waitForActiveWorktree(dolphinPage)
  await ensureTerminalVisible(dolphinPage, 30_000)
  await waitForActiveTerminalManager(dolphinPage, 30_000)
  const ptyId = await waitForActivePanePtyId(dolphinPage, 30_000)
  await expect.poll(() => dolphinPage.evaluate((id) => window.api.pty.hasPty(id), ptyId)).toBe(true)

  const marker = `dolphin-e2e-fresh-${Date.now()}`
  await focusActiveTerminalInput(dolphinPage)
  await dolphinPage.keyboard.type(`echo ${marker}`)
  await dolphinPage.keyboard.press('Enter')
  await expect
    .poll(async () => (await getTerminalContent(dolphinPage)).split(marker).length - 1, {
      message: 'marker should appear in both the echoed command and command output'
    })
    .toBeGreaterThanOrEqual(2)

  await focusActiveTerminalInput(dolphinPage)
  await dolphinPage.keyboard.type('git rev-parse --show-toplevel')
  await dolphinPage.keyboard.press('Enter')
  await expect
    .poll(async () => (await getTerminalContent(dolphinPage)).replaceAll('\\', '/'), {
      message: 'fresh project terminal should start in the selected repository'
    })
    .toContain(repoPath.replaceAll('\\', '/'))
})
