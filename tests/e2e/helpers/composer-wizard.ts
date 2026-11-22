import type { Locator } from '@playwright/test'

/**
 * The New workspace composer is a wizard: Basics, then Mode (Worktree preselected), where Create
 * lives. Clicks Next when the composer is still on Basics; does nothing once Create is in view.
 */
export async function advanceComposerToCreateStep(dialog: Locator): Promise<void> {
  const next = dialog.getByRole('button', { name: 'Next', exact: true })
  if (!(await next.isVisible())) {
    return
  }
  // Why: typing a name opens the portaled suggestions list over the footer; Escape closes only
  // that list, as a user would before clicking Next.
  const suggestions = dialog.page().locator('[data-workspace-source-suggestions="true"]')
  if (await suggestions.isVisible()) {
    await dialog.page().keyboard.press('Escape')
    await suggestions.waitFor({ state: 'hidden' })
  }
  await next.click()
}
