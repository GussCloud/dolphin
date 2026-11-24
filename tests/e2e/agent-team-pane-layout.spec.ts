/**
 * Agent Teams teammate splits arrive as `ui:splitTerminal` with `agentTeamLeaderLeafId`; the
 * team is laid out in equal cards (leader left half, teammates share the right half: one column
 * up to three, two from four, an odd last one spanning its row) and every xterm grid fits its
 * card. A plain split, the same payload without the leader, keeps the halving layout.
 */

import { randomUUID } from 'node:crypto'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { getActiveWorktreeId } from './helpers/store'
import { waitForPaneCount, waitForPaneIdentitySnapshot } from './helpers/terminal'
import { registerTerminalPaneMountReadiness } from './helpers/terminal-pane-mount-readiness'

type Rect = { left: number; top: number; width: number; height: number }
type PaneBox = Rect & { leafId: string; screen: Rect | null }
type TeamTab = { tabId: string; worktreeId: string; leaderLeafId: string; leaderPaneId: number }

async function readTeamTab(page: Page): Promise<TeamTab> {
  const snapshot = await waitForPaneIdentitySnapshot(page, 1)
  const leader = snapshot.panes[0]
  const worktreeId = await getActiveWorktreeId(page)
  if (!leader || !worktreeId) {
    throw new Error('No mounted terminal pane to lead the team')
  }
  return {
    tabId: snapshot.tabId,
    worktreeId,
    leaderLeafId: leader.leafId,
    leaderPaneId: leader.numericPaneId
  }
}

/** Sends the split the main process sends for a tmux `split-window`, from the leader pane. */
async function sendSplitFromLeader(
  electronApp: ElectronApplication,
  tab: TeamTab,
  { asTeammate }: { asTeammate: boolean }
): Promise<string> {
  const newLeafId = randomUUID()
  await electronApp.evaluate(
    ({ BrowserWindow }, payload) => {
      const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
      if (!window) {
        throw new Error('Dolphin BrowserWindow is unavailable')
      }
      window.webContents.send('ui:splitTerminal', payload)
    },
    {
      tabId: tab.tabId,
      worktreeId: tab.worktreeId,
      paneRuntimeId: tab.leaderPaneId,
      sourceLeafId: tab.leaderLeafId,
      direction: 'vertical' as const,
      newLeafId,
      ...(asTeammate ? { agentTeamLeaderLeafId: tab.leaderLeafId } : {})
    }
  )
  return newLeafId
}

async function readPaneBoxes(
  page: Page,
  tabId: string
): Promise<{ panes: PaneBox[]; dividerThickness: number }> {
  return page.evaluate((tabId) => {
    const toRect = (rect: DOMRect): Rect => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    })
    const manager = window.__paneManagers?.get(tabId)
    const panes = (manager?.getPanes() ?? []).map((pane) => {
      const card = pane.container
      const rect = card.getBoundingClientRect()
      const screen = card.querySelector<HTMLElement>('.xterm-screen')
      // The card's inner box: the grid must fit inside the border.
      return {
        leafId: pane.leafId,
        left: rect.left + card.clientLeft,
        top: rect.top + card.clientTop,
        width: card.clientWidth,
        height: card.clientHeight,
        screen: screen ? toRect(screen.getBoundingClientRect()) : null
      }
    })
    const cardRoot = manager?.getPanes()[0]?.container.closest('.pane-card-root')
    const dividers = [...(cardRoot?.querySelectorAll<HTMLElement>('.pane-divider') ?? [])].map(
      (divider) => {
        const rect = divider.getBoundingClientRect()
        return Math.min(rect.width, rect.height)
      }
    )
    return { panes, dividerThickness: Math.max(0, ...dividers) }
  }, tabId)
}

const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance

/** Grid overflow problems; xterm sizes `.xterm-screen` to cols × cell width and rows × cell height. */
function gridFitProblems(panes: readonly PaneBox[]): string[] {
  return panes.flatMap((pane) => {
    const { screen } = pane
    if (!screen) {
      return [`${pane.leafId}: no rendered xterm grid`]
    }
    const fits =
      screen.left >= pane.left - 0.5 &&
      screen.top >= pane.top - 0.5 &&
      screen.left + screen.width <= pane.left + pane.width + 0.5 &&
      screen.top + screen.height <= pane.top + pane.height + 0.5
    return fits
      ? []
      : [
          `${pane.leafId}: grid ${screen.width}x${screen.height} overflows ${pane.width}x${pane.height}`
        ]
  })
}

function teamLayoutProblems(
  measured: { panes: PaneBox[]; dividerThickness: number },
  leaderLeafId: string,
  teammateLeafIds: readonly string[]
): string[] {
  // Equal means equal: only card borders and subpixel rounding may differ.
  const tolerance = 2
  const byLeaf = new Map(measured.panes.map((pane) => [pane.leafId, pane]))
  const leader = byLeaf.get(leaderLeafId)
  const teammates = teammateLeafIds.map((leafId) => byLeaf.get(leafId))
  if (!leader || teammates.some((pane) => !pane)) {
    return ['team panes are not all mounted']
  }
  const team = teammates.filter((pane): pane is PaneBox => pane !== undefined)
  const problems: string[] = []
  const region = {
    left: Math.min(...team.map((pane) => pane.left)),
    top: Math.min(...team.map((pane) => pane.top)),
    right: Math.max(...team.map((pane) => pane.left + pane.width)),
    bottom: Math.max(...team.map((pane) => pane.top + pane.height))
  }
  const regionWidth = region.right - region.left
  if (team.some((pane) => pane.left < leader.left + leader.width)) {
    problems.push('a teammate overlaps the leader column')
  }
  if (!near(leader.width, regionWidth, tolerance)) {
    problems.push(`leader width ${leader.width} is not half (teammates ${regionWidth})`)
  }
  if (
    !near(leader.top, region.top, tolerance) ||
    !near(leader.height, region.bottom - region.top, tolerance)
  ) {
    problems.push('leader does not span the full team height')
  }
  const columns = teammateLeafIds.length <= 3 ? 1 : 2
  const columnLefts = new Set(team.map((pane) => Math.round(pane.left / 4)))
  if (columnLefts.size !== columns) {
    problems.push(`expected ${columns} teammate column(s), saw ${columnLefts.size}`)
  }
  const heights = team.map((pane) => pane.height)
  if (Math.max(...heights) - Math.min(...heights) > tolerance) {
    problems.push(`teammate heights differ: ${heights.join(', ')}`)
  }
  const spansLastRow = columns === 2 && team.length % 2 === 1
  const cellWidths = (spansLastRow ? team.slice(0, -1) : team).map((pane) => pane.width)
  const expectedCellWidth =
    columns === 1 ? regionWidth : (regionWidth - measured.dividerThickness) / 2
  if (cellWidths.some((width) => !near(width, expectedCellWidth, tolerance))) {
    problems.push(`teammate widths ${cellWidths.join(', ')} are not ${expectedCellWidth}`)
  }
  const lastWidth = team.at(-1)?.width ?? 0
  if (spansLastRow && !near(lastWidth, regionWidth, tolerance)) {
    problems.push(`odd last teammate width ${lastWidth} does not span ${regionWidth}`)
  }
  return problems
}

test.describe('Agent team pane layout', () => {
  registerTerminalPaneMountReadiness()

  test('teammates share the right half in equal cards whose grids fit', async ({
    electronApp,
    appPage
  }) => {
    const tab = await readTeamTab(appPage)
    const teammateLeafIds: string[] = []
    for (let count = 1; count <= 5; count += 1) {
      teammateLeafIds.push(await sendSplitFromLeader(electronApp, tab, { asTeammate: true }))
      await waitForPaneCount(appPage, count + 1)
      await expect
        .poll(
          async () => {
            const measured = await readPaneBoxes(appPage, tab.tabId)
            return [
              ...teamLayoutProblems(measured, tab.leaderLeafId, teammateLeafIds),
              ...gridFitProblems(measured.panes)
            ]
          },
          { message: `Team layout with ${count} teammate(s) is not balanced or overflows` }
        )
        .toEqual([])
    }
  })

  test('a plain split from the leader keeps halving instead of balancing', async ({
    electronApp,
    appPage
  }) => {
    const tab = await readTeamTab(appPage)
    const first = await sendSplitFromLeader(electronApp, tab, { asTeammate: false })
    await waitForPaneCount(appPage, 2)
    const second = await sendSplitFromLeader(electronApp, tab, { asTeammate: false })
    await waitForPaneCount(appPage, 3)

    await expect
      .poll(async () => {
        const { panes, dividerThickness } = await readPaneBoxes(appPage, tab.tabId)
        const width = (leafId: string): number =>
          panes.find((pane) => pane.leafId === leafId)?.width ?? 0
        const tolerance = dividerThickness + 2
        // Each split halves the leader: leader and newest take a quarter each, the first a half.
        return {
          leaderIsQuarter: near(width(tab.leaderLeafId), width(second), tolerance),
          firstIsHalf: near(width(first), width(tab.leaderLeafId) + width(second), 2 * tolerance),
          singleRow: new Set(panes.map((pane) => Math.round(pane.top))).size === 1,
          gridProblems: gridFitProblems(panes)
        }
      })
      .toEqual({ leaderIsQuarter: true, firstIsHalf: true, singleRow: true, gridProblems: [] })
  })
})
