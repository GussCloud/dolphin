// Pure analysis for session-lifecycle-benchmark.mjs; takes `dolphin diagnostics runtime --json` samples.

/** The figures a leak shows up in, pulled from one diagnostics sample. */
export function summarizeSample(sample) {
  const memory = sample.memory ?? {}
  const sessions = sample.sessions ?? {}
  const storage = sample.storage ?? {}
  return {
    at: sample.collectedAt,
    registeredPtys: sessions.registeredPtyCount ?? 0,
    daemonSessions: sessions.daemonSessionCount ?? null,
    inconsistencies: (sessions.inconsistencies ?? []).length,
    orphanedSessions: (sessions.inconsistencies ?? []).filter(
      (f) => f.kind === 'daemon-session-orphaned'
    ).length,
    trackedProcesses: memory.trackedProcessCount ?? null,
    untrackedDaemonDescendants: memory.daemon?.untrackedDescendantCount ?? null,
    rendererBytes: memory.app?.renderer?.memory ?? 0,
    mainBytes: memory.app?.main?.memory ?? 0,
    daemonBytes: memory.daemon?.memory ?? null,
    storageBytes: storage.totalBytes ?? 0
  }
}

/**
 * Churn verdict: after N create/close cycles and a settle wait, session and process counts must be
 * back at baseline. Memory is reported, not judged: allocator high-water marks are expected.
 */
export function evaluateChurn(baseline, after) {
  const failures = []
  const counts = [
    'registeredPtys',
    'daemonSessions',
    'orphanedSessions',
    'trackedProcesses',
    'untrackedDaemonDescendants'
  ]
  for (const key of counts) {
    if (baseline[key] !== null && after[key] !== null && after[key] > baseline[key]) {
      failures.push(`${key} grew from ${baseline[key]} to ${after[key]}`)
    }
  }
  return {
    passed: failures.length === 0,
    failures,
    delta: Object.fromEntries(
      Object.keys(after)
        .filter((key) => typeof after[key] === 'number' && typeof baseline[key] === 'number')
        .map((key) => [key, after[key] - baseline[key]])
    )
  }
}

/**
 * Soak verdict: growth of each memory figure from the first sample after warm-up to the last.
 * The roadmap's starting threshold is 10%; calibrate it once a baseline exists.
 */
export function evaluateSoak(samples, { warmupSamples = 1, maxGrowthRatio = 0.1 } = {}) {
  const stable = samples.slice(Math.min(warmupSamples, Math.max(0, samples.length - 2)))
  if (stable.length < 2) {
    return { passed: true, failures: [], growth: {}, note: 'not enough samples to judge' }
  }
  const first = stable[0]
  const last = stable.at(-1)
  const growth = {}
  const failures = []
  for (const key of ['rendererBytes', 'mainBytes', 'daemonBytes']) {
    if (typeof first[key] !== 'number' || typeof last[key] !== 'number' || first[key] <= 0) {
      continue
    }
    growth[key] = (last[key] - first[key]) / first[key]
    if (growth[key] > maxGrowthRatio) {
      failures.push(`${key} grew ${(growth[key] * 100).toFixed(1)}% after warm-up`)
    }
  }
  for (const key of ['orphanedSessions', 'untrackedDaemonDescendants']) {
    if ((last[key] ?? 0) > (first[key] ?? 0)) {
      failures.push(`${key} grew from ${first[key]} to ${last[key]}`)
    }
  }
  return { passed: failures.length === 0, failures, growth }
}
