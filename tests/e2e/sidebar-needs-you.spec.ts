import { expect, test } from './helpers/dolphin-app'
import { getActiveWorktreeId, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import type { AgentStatusPayload } from '../../src/shared/agent-status-types'

const QUESTION = 'Which spacing scale should I use for the sidebar rows?'
const TOOL_INPUT = 'src/auth/session.ts'

type SeededPanes = { waitingWorktreeId: string; workingWorktreeId: string }

test('Needs you lists a waiting agent with its question and Reply opens its workspace', async ({
  appPage
}) => {
  await waitForSessionReady(appPage)
  const activeWorktreeId = await waitForActiveWorktree(appPage)

  const seeded = await appPage.evaluate(
    ({ activeWorktreeId, question, toolInput }): SeededPanes => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is unavailable')
      }
      const state = store.getState()
      const other = Object.values(state.worktreesByRepo)
        .flat()
        .find((worktree) => worktree.id !== activeWorktreeId)
      if (!other) {
        throw new Error('the e2e repo needs a second worktree')
      }
      const now = Date.now()
      const seedPane = (
        worktreeId: string,
        tabId: string,
        leafId: string,
        entry: AgentStatusPayload & { prompt: string }
      ): void => {
        store
          .getState()
          .setAgentStatus(
            `${tabId}:${leafId}`,
            { agentType: 'claude', ...entry },
            'Claude',
            { updatedAt: now, stateStartedAt: now },
            { tabId, terminalHandle: `needs-you-${leafId}`, worktreeId }
          )
      }

      // Why the inactive worktree: Reply must visibly switch workspaces to prove it activated the pane's owner.
      const waitingTab = state.createTab(other.id, undefined, undefined, {
        activate: false,
        id: 'needs-you-waiting-tab'
      })
      seedPane(other.id, waitingTab.id, '00000000-0000-4000-8000-000000000001', {
        state: 'waiting',
        prompt: 'Tune the sidebar density',
        toolName: 'AskUserQuestion',
        interactivePrompt: JSON.stringify({
          questions: [
            {
              question,
              header: 'Spacing',
              multiSelect: false,
              options: [{ label: '4px base' }, { label: '8px base' }]
            }
          ]
        })
      })

      const workingTab =
        state.tabsByWorktree[activeWorktreeId]?.[0] ??
        state.createTab(activeWorktreeId, undefined, undefined, {
          activate: false,
          id: 'needs-you-working-tab'
        })
      seedPane(activeWorktreeId, workingTab.id, '00000000-0000-4000-8000-000000000002', {
        state: 'working',
        prompt: 'Fix login redirect loop',
        toolName: 'Edit',
        toolInput
      })

      return { waitingWorktreeId: other.id, workingWorktreeId: activeWorktreeId }
    },
    { activeWorktreeId, question: QUESTION, toolInput: TOOL_INPUT }
  )

  const section = appPage.locator('[data-needs-you-section]')
  await expect(section).toBeVisible()
  await expect(section.locator('li')).toHaveCount(1)
  await expect(section).toContainText(QUESTION)
  await expect(section).toContainText('Needs input')

  // The working agent's live tool shows in its own inset block on the card.
  await expect(
    appPage.locator('[data-agent-tool-telemetry]').filter({ hasText: TOOL_INPUT })
  ).toBeVisible()

  expect(await getActiveWorktreeId(appPage)).toBe(seeded.workingWorktreeId)
  await section.getByRole('button', { name: 'Reply' }).click()
  await expect.poll(() => getActiveWorktreeId(appPage)).toBe(seeded.waitingWorktreeId)
})
