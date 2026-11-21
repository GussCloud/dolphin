import type { Locator } from '@playwright/test'

/**
 * The New workspace composer is a wizard: Basics, then Mode (Worktree preselected), where Create
 * lives. Clicks Next when the composer is still on Basics; does nothing once Create is in view.
 */
export async function advanceComposerToCreateStep(dialog: Locator): Promise<void> {
  const next = dialog.getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) {
    await next.click()
  }
}
