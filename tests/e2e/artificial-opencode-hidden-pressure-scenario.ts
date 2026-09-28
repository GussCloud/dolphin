import type { Page, TestInfo } from '@stablyai/playwright-test'
import { expect } from '@stablyai/playwright-test'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import path from 'node:path'
import {
  type HiddenPressureOutputMode,
  writePressureOutputScript
} from './artificial-opencode-hidden-pressure-script'
import {
  ensureTerminalVisible,
  getActiveWorktreeId,
  getAllWorktreeIds,
  switchToWorktree,
  waitForActiveWorktree,
  waitForSessionReady
} from './helpers/store'
import {
  resolveActiveTabId,
  sendToTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'
import { readActiveScreen } from './helpers/alt-screen-frame'

type HiddenPressurePane = {
  ptyId: string
}

type HiddenPressureDeps<TMeasurement, TDebug, TScheduler, TMainPressure, TAckGate> = {
  annotateTypingMeasurement: (
    testInfo: TestInfo,
    type: string,
    paneCount: number,
    measurement: TMeasurement,
    debug: TDebug | null,
    scheduler: TScheduler | null,
    mainPressure: TMainPressure | null,
    ackGate: TAckGate | null
  ) => void
  ensureActiveWorktreePaneLoad: (page: Page, paneCount: number) => Promise<HiddenPressurePane[]>
  holdTerminalAckGate: (page: Page, ptyIds: string[]) => Promise<void>
  measureTypingDuringLoad: (
    page: Page,
    scriptPath: string,
    ptyId: string,
    runId: string
  ) => Promise<TMeasurement>
  readMainPtyPressureDebug: (page: Page) => Promise<TMainPressure | null>
  readTerminalAckGateDebug: (page: Page) => Promise<TAckGate | null>
  readTerminalOutputSchedulerDebug: (page: Page) => Promise<TScheduler | null>
  readTerminalPtyOutputDebug: (page: Page) => Promise<TDebug | null>
  releaseTerminalAckGate: (page: Page) => Promise<void>
  resetTerminalPtyOutputDebug: (page: Page) => Promise<void>
  writeInteractivePromptScript: (scriptPath: string, runId: string) => void
}

type HiddenPressureDebug = {
  hiddenRendererSkipCount: number
}

type HiddenPressureMeasurement = {
  medianLatencyMs: number
  worstLatencyMs: number
  maxTimerDriftMs: number
}

type HiddenPressureMainSnapshot = {
  peakPendingChars: number
  peakRendererInFlightChars: number
  ackGatedFlushSkipCount: number
  hiddenDeliveryDroppedChars: number
  hiddenDeliveryGatedPtyCount: number
}

type HiddenPressureSchedulerSnapshot = {
  peakQueuedChars: number
  droppedBacklogCount: number
}

type HiddenPressureAckGate = {
  heldAckChars: number
}

// Why: restore still has to finish promptly, but parallel Electron workers on
// Linux CI can overshoot the 1s product target without a responsiveness regression.
// 4s covers drain-plus-poll overhead on loaded OSS runners. The post-flood repaint path
// spends ~2.75s of that (750ms deadline + 2s suppression), so the poll below reads the
// viewport on a fixed interval rather than serializing scrollback on a backoff.
const MAX_HIDDEN_RESTORE_LATENCY_MS = 4_000
// Why: Phase-4 hidden-delivery gate contract — hidden PTY bytes are dropped in
// main after model ingestion, so renderer-delivery pressure must stay FAR
// below the old 2 MB ACK-backpressure target instead of reaching it.
const MAIN_RENDERER_PRESSURE_TARGET_CHARS = 2 * 1024 * 1024
// Why: in this hidden real-PTY pressure case, maxTimerDriftMs and worst-key
// latency catch the same isolated CI starvation spike; median remains strict.
const MAX_HIDDEN_PRESSURE_TIMER_DRIFT_MS = 3_000

export async function runHiddenRealPtyPressureScenario<
  TMeasurement extends HiddenPressureMeasurement,
  TDebug extends HiddenPressureDebug,
  TMainPressure extends HiddenPressureMainSnapshot,
  TAckGate extends HiddenPressureAckGate,
  TScheduler extends HiddenPressureSchedulerSnapshot
>({
  deps,
  annotationSuffix,
  hiddenPaneCount,
  pressureOutputChars,
  pressureOutputMode = 'tui',
  pressureStartDelayMs,
  testInfo,
  testRepoPath,
  dolphinPage
}: {
  deps: HiddenPressureDeps<TMeasurement, TDebug, TScheduler, TMainPressure, TAckGate>
  annotationSuffix?: string
  hiddenPaneCount: number
  pressureOutputChars: number
  pressureOutputMode?: HiddenPressureOutputMode
  pressureStartDelayMs: number
  testInfo: TestInfo
  testRepoPath: string
  dolphinPage: Page
}): Promise<void> {
  await waitForSessionReady(dolphinPage)
  const firstWorktreeId = await waitForActiveWorktree(dolphinPage)
  const allWorktreeIds = await getAllWorktreeIds(dolphinPage)
  const secondWorktreeId = allWorktreeIds.find((id) => id !== firstWorktreeId)
  expect(Boolean(secondWorktreeId), 'OpenCode hidden PTY pressure needs a second worktree').toBe(
    true
  )
  if (!secondWorktreeId) {
    return
  }

  await switchToWorktree(dolphinPage, secondWorktreeId)
  const hiddenPanes = await deps.ensureActiveWorktreePaneLoad(dolphinPage, hiddenPaneCount)

  const runId = randomUUID()
  const typingScriptPath = path.join(
    testRepoPath,
    `.dolphin-opencode-hidden-pressure-typing-${runId}.mjs`
  )
  const pressureScriptPath = path.join(
    testRepoPath,
    `.dolphin-opencode-hidden-pressure-load-${runId}.mjs`
  )
  deps.writeInteractivePromptScript(typingScriptPath, runId)
  writePressureOutputScript(pressureScriptPath, runId, pressureOutputMode)

  await deps.resetTerminalPtyOutputDebug(dolphinPage)
  await deps.holdTerminalAckGate(
    dolphinPage,
    hiddenPanes.map((pane) => pane.ptyId)
  )
  try {
    await startHiddenPressureCommands({
      hiddenPanes,
      dolphinPage,
      pressureOutputChars,
      pressureScriptPath,
      pressureStartDelayMs
    })
    await switchToTypingWorkspace(dolphinPage, firstWorktreeId)
    const typingPtyId = await waitForActivePanePtyId(dolphinPage)

    // Why: under the Phase-4 hidden-delivery gate the hidden panes' bytes are
    // dropped in main after model ingestion, so renderer-delivery pressure
    // never builds. Wait for the gate to drop at least one pane's worth of
    // output instead of the old 2 MB ACK-backpressure target.
    await waitForMainHiddenDeliveryDrops(dolphinPage, deps, pressureOutputChars)
    const measurement = await deps.measureTypingDuringLoad(
      dolphinPage,
      typingScriptPath,
      typingPtyId,
      runId
    )
    const debug = await deps.readTerminalPtyOutputDebug(dolphinPage)
    const scheduler = await deps.readTerminalOutputSchedulerDebug(dolphinPage)
    const mainPressure = await deps.readMainPtyPressureDebug(dolphinPage)
    const ackGate = await deps.readTerminalAckGateDebug(dolphinPage)
    deps.annotateTypingMeasurement(
      testInfo,
      `opencode-hidden-real-pty-pressure-typing${annotationSuffix ?? ''}`,
      hiddenPanes.length + 1,
      measurement,
      debug,
      scheduler,
      mainPressure,
      ackGate
    )

    // Hidden-delivery contract (all pressure modes): bytes never reach the
    // renderer — main's drop counter is the withheld-output signal (the
    // renderer skip counters were deleted with the skip grammar) — and main's
    // renderer-delivery pressure must stay clearly below the old 2 MB
    // backpressure target.
    expect(mainPressure?.hiddenDeliveryDroppedChars ?? 0).toBeGreaterThanOrEqual(
      pressureOutputChars
    )
    expect(mainPressure?.peakRendererInFlightChars ?? 0).toBeLessThan(
      MAIN_RENDERER_PRESSURE_TARGET_CHARS
    )
    // Why: the renderer scheduler queue must stay ~empty (no hidden bytes to
    // queue) and must never drop a backlog — strict, per the gate contract.
    expect(scheduler?.peakQueuedChars ?? 0).toBeLessThan(pressureOutputChars)
    expect(scheduler?.droppedBacklogCount ?? Number.POSITIVE_INFINITY).toBe(0)
    expect(measurement.medianLatencyMs).toBeLessThan(75)
    // Why: worst *single-key echo* under 8MB synthetic backpressure lands behind
    // whichever flush it collides with, so on a contended OSS shard it is
    // environment-dominated (seen at ~2s). Keep it only as a catastrophic-hang
    // detector — the original regression (input freezing for seconds) shows up in
    // the median too. Aligns with ssh-docker-relay-perf's 2s worst-key tolerance.
    expect(measurement.worstLatencyMs).toBeLessThan(3_000)
    expect(measurement.maxTimerDriftMs).toBeLessThan(MAX_HIDDEN_PRESSURE_TIMER_DRIFT_MS)

    await deps.releaseTerminalAckGate(dolphinPage)
    const restoreLatencyMs = await measureHiddenOutputRestoreLatency(
      dolphinPage,
      secondWorktreeId,
      runId
    )
    testInfo.annotations.push({
      type: `opencode-hidden-real-pty-restore${annotationSuffix ?? ''}`,
      description: `panes=${hiddenPanes.length + 1} restore=${restoreLatencyMs.toFixed(
        1
      )}ms hiddenDeliveryDroppedChars=${
        mainPressure?.hiddenDeliveryDroppedChars ?? 0
      } mainPeakInFlightChars=${mainPressure?.peakRendererInFlightChars ?? 0} heldAckChars=${
        ackGate?.heldAckChars ?? 0
      }`
    })
    expect(restoreLatencyMs).toBeLessThan(MAX_HIDDEN_RESTORE_LATENCY_MS)
  } finally {
    await cleanupHiddenPressureScenario({
      deps,
      firstWorktreeId,
      hiddenPanes,
      dolphinPage,
      pressureScriptPath,
      secondWorktreeId,
      typingScriptPath
    })
  }
}

// Why: replaces the old waitForMainPtyPressureBacklog premise — the Phase-4
// gate drops hidden bytes in main, so renderer-delivery pressure never builds;
// readiness is the gate reporting one pane's worth of dropped output.
async function waitForMainHiddenDeliveryDrops<TMainPressure extends HiddenPressureMainSnapshot>(
  dolphinPage: Page,
  deps: { readMainPtyPressureDebug: (page: Page) => Promise<TMainPressure | null> },
  pressureOutputChars: number
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await deps.readMainPtyPressureDebug(dolphinPage))?.hiddenDeliveryDroppedChars ?? 0,
      { timeout: 30_000, message: 'Main hidden-delivery gate did not drop hidden PTY output' }
    )
    .toBeGreaterThanOrEqual(pressureOutputChars)
}

async function measureHiddenOutputRestoreLatency(
  dolphinPage: Page,
  worktreeId: string,
  runId: string
): Promise<number> {
  const restoreStart = performance.now()
  await switchToWorktree(dolphinPage, worktreeId)
  // Why resolve rather than read activeTabId: after a worktree switch the active tab can
  // still be the previous worktree's, or a non-terminal one; this picks the worktree's own.
  const tabId = (await resolveActiveTabId(dolphinPage)) ?? ''
  await expect
    .poll(async () => (await readActiveScreen(dolphinPage, tabId))?.rows.join('\n') ?? '', {
      timeout: 20_000,
      // One-second backoff can dominate the measured restore latency.
      intervals: [50],
      message: 'No restored output from main buffer on return (or no active terminal pane)'
    })
    .toContain(`OPENCODE_PRESSURE_DONE_${runId}_`)
  return performance.now() - restoreStart
}

async function startHiddenPressureCommands({
  hiddenPanes,
  dolphinPage,
  pressureOutputChars,
  pressureScriptPath,
  pressureStartDelayMs
}: {
  hiddenPanes: HiddenPressurePane[]
  dolphinPage: Page
  pressureOutputChars: number
  pressureScriptPath: string
  pressureStartDelayMs: number
}): Promise<void> {
  await Promise.all(
    hiddenPanes.map((pane, paneIndex) =>
      sendToTerminal(
        dolphinPage,
        pane.ptyId,
        `node ${JSON.stringify(pressureScriptPath)} ${paneIndex} ${pressureOutputChars} ${pressureStartDelayMs}\r`
      )
    )
  )
}

async function switchToTypingWorkspace(dolphinPage: Page, worktreeId: string): Promise<void> {
  await switchToWorktree(dolphinPage, worktreeId)
  await expect.poll(() => getActiveWorktreeId(dolphinPage), { timeout: 10_000 }).toBe(worktreeId)
  await ensureTerminalVisible(dolphinPage)
  await waitForActiveTerminalManager(dolphinPage, 30_000)
}

async function cleanupHiddenPressureScenario<
  TMeasurement,
  TDebug,
  TScheduler,
  TMainPressure,
  TAckGate
>({
  deps,
  firstWorktreeId,
  hiddenPanes,
  dolphinPage,
  pressureScriptPath,
  secondWorktreeId,
  typingScriptPath
}: {
  deps: HiddenPressureDeps<TMeasurement, TDebug, TScheduler, TMainPressure, TAckGate>
  firstWorktreeId: string
  hiddenPanes: HiddenPressurePane[]
  dolphinPage: Page
  pressureScriptPath: string
  secondWorktreeId: string
  typingScriptPath: string
}): Promise<void> {
  await deps.releaseTerminalAckGate(dolphinPage)
  await switchToWorktree(dolphinPage, firstWorktreeId).catch(() => undefined)
  await waitForActivePanePtyId(dolphinPage)
    .then((ptyId) => sendToTerminal(dolphinPage, ptyId, '\x03'))
    .catch(() => undefined)
  await switchToWorktree(dolphinPage, secondWorktreeId).catch(() => undefined)
  await Promise.all(
    hiddenPanes.map((pane) =>
      sendToTerminal(dolphinPage, pane.ptyId, '\x03').catch(() => undefined)
    )
  )
  rmSync(typingScriptPath, { force: true })
  rmSync(pressureScriptPath, { force: true })
}
