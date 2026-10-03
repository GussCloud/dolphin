// Historical measurements and rationale: docs/reference/terminal-perf-report-budgets.md.
const MIB = 1024 * 1024
// Renderer JS heap ceilings for the 8-tab parked-memory scenarios; rationale in the doc above.
const PARKED_MEMORY_HEAP_BUDGET_MB = 128
const PARKING_DISABLED_HEAP_BUDGET_MB = 192

const DEFAULT_BUDGETS = {
  median: 25,
  worst: 300,
  revisit: 300,
  maxTimerDrift: 150,
  scroll: 150,
  restore: 1_000,
  rendererQueuedChars: 2 * MIB,
  rendererPeakQueuedChars: 2 * MIB,
  rendererDroppedBacklogs: 0
}

export function reportBudgetsForScenario(scenario) {
  const budgets = { ...DEFAULT_BUDGETS }
  // Preserve the existing report gate's injected-redraw drift allowance.
  if (
    scenario === 'opencode-same-workspace-typing' ||
    scenario === 'opencode-cross-workspace-typing' ||
    scenario.startsWith('opencode-scale-same-workspace-') ||
    scenario.startsWith('opencode-scale-cross-workspace-')
  ) {
    budgets.maxTimerDrift = 3_500
  }
  if (
    scenario === 'opencode-main-pressure-active-typing' ||
    scenario.startsWith('opencode-main-pressure-active-typing-') ||
    scenario === 'opencode-main-pressure-worktree-revisit-typing' ||
    scenario === 'opencode-main-pressure-worktree-revisit-drain'
  ) {
    // Only the transient peak gets headroom; current backlog must still drain below 2 MiB.
    budgets.rendererPeakQueuedChars = 3.5 * MIB
  }
  if (scenario === 'opencode-parked-memory') {
    budgets.heapUsedMB = PARKED_MEMORY_HEAP_BUDGET_MB
    // Only the visible tab and the last-active warm tab may keep a live view.
    budgets.liveTerminals = 2
    budgets.livePaneManagers = 2
  }
  if (scenario === 'opencode-parked-memory-disabled') {
    budgets.heapUsedMB = PARKING_DISABLED_HEAP_BUDGET_MB
  }
  return budgets
}
