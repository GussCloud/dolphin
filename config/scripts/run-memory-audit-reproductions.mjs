import { spawnSync } from 'node:child_process'

const MIB = 1024 * 1024
const REPRODUCTION_TIMEOUT_MS = 120_000

function heapCasePairs(results) {
  const fixed = results.filter((result) => result.fixed)
  return fixed.map((after) => ({
    after,
    before: results.find(
      (result) =>
        !result.fixed &&
        result.kind === after.kind &&
        result.inputChars === after.inputChars &&
        result.count === after.count
    )
  }))
}

// Why: a fixed case must also beat its in-memory baseline, or the harness has
// silently stopped exercising the defect and the ceiling proves nothing.
function heapRetentionFailures(output, absoluteCeiling) {
  const failures = []
  const pairs = heapCasePairs(output.results ?? [])
  if (pairs.length === 0) {
    return ['no fixed heap cases reported']
  }
  for (const { after, before } of pairs) {
    const label = `${after.kind}${after.inputChars ? ` ${after.inputChars} chars` : ''}`
    if (!before) {
      failures.push(`${label}: no baseline case to compare`)
      continue
    }
    if (after.heapDelta * 2 > before.heapDelta) {
      failures.push(
        `${label}: retained ${after.heapDelta} B, not under half the ${before.heapDelta} B baseline`
      )
    }
    const ceiling = absoluteCeiling(after)
    if (after.heapDelta > ceiling) {
      failures.push(`${label}: retained ${after.heapDelta} B exceeded ceiling ${ceiling} B`)
    }
  }
  return failures
}

// Cheap, deterministic, platform-neutral memory reproductions from docs/audits.
// Each oracle gates the CURRENT source; the scripts' own baselines prove the defect.
export const MEMORY_AUDIT_REPRODUCTIONS = [
  {
    audit: 'scanner-late-cancel',
    nodeFlags: ['--max-old-space-size=128'],
    check: (output) => {
      const after = output.after ?? {}
      return ['pending', 'controllers', 'cancelled']
        .filter((field) => after[field] !== 0)
        .map((field) => `after.${field} is ${after[field]}, expected 0`)
    }
  },
  {
    audit: 'pty-detector-retention',
    nodeFlags: ['--expose-gc'],
    check: (output) => heapRetentionFailures(output, () => MIB)
  },
  {
    audit: 'retained-text-slices',
    nodeFlags: ['--expose-gc'],
    // Owned copies may cost the returned bytes plus allocator slack, never the parent input.
    check: (output) =>
      heapRetentionFailures(output, (after) => Math.ceil(after.logicalBytes * 1.5) + 64 * 1024)
  },
  {
    audit: 'cdp-stream-retention',
    nodeFlags: [],
    // The unbounded writer buffered all 128 MiB; the fixed one stops near its 8 MiB threshold.
    check: (output) => {
      const samples = output.samples ?? []
      if (samples.length === 0) {
        return ['no socket samples reported']
      }
      const peak = Math.max(...samples.map((sample) => sample.bufferedBytes))
      return peak > 16 * MIB ? [`socket buffered ${peak} B, over the 16 MiB ceiling`] : []
    }
  },
  {
    audit: 'daemon-stream-retention',
    nodeFlags: [],
    check: (output) => {
      const cases = output.cases ?? []
      if (cases.length === 0) {
        return ['no stream cases reported']
      }
      const failures = []
      for (const entry of cases) {
        const label = `${entry.hidden ? 'hidden' : 'visible'} ${entry.chunkSize} B chunks`
        if (!entry.hidden && entry.stalled?.producedChars >= 8 * MIB) {
          failures.push(`${label}: producer consumed the whole input before pausing`)
        }
        const drained = entry.afterDrain ?? {}
        if (drained.producerPaused || drained.socketBufferedBytes || drained.batcherQueuedChars) {
          failures.push(`${label}: queues did not drain after the reader resumed`)
        }
      }
      return failures
    }
  },
  {
    audit: 'claude-task-retention',
    script: 'reproduce.cjs',
    nodeFlags: ['--expose-gc'],
    check: (output) => {
      const results = output.results ?? []
      if (!results.some((result) => result.phase === 'before')) {
        return ['no baseline case to prove the defect is exercised']
      }
      return results
        .filter((result) => result.phase === 'after' && result.retainedHeapBytes >= MIB)
        .map(
          (result) =>
            `${result.ingress} ${result.retention} ${result.size} chars: retained ${result.retainedHeapBytes} B, ceiling ${MIB} B`
        )
    }
  }
]

export function reproductionScript(reproduction) {
  return `docs/audits/${reproduction.audit}/${reproduction.script ?? 'reproduce.mjs'}`
}

export function parseReproductionOutput(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('no JSON result printed')
  }
  return JSON.parse(stdout.slice(start, end + 1))
}

export function evaluateReproduction(reproduction, result) {
  if (result.error) {
    return [`failed to start: ${result.error.message}`]
  }
  if (result.signal) {
    return [`exited with signal ${result.signal}`]
  }
  if (result.status !== 0) {
    const stderrTail = String(result.stderr ?? '')
      .trim()
      .split('\n')
      .slice(-5)
      .join('\n')
    return [`exited ${result.status}${stderrTail ? `:\n${stderrTail}` : ''}`]
  }
  let output
  try {
    output = parseReproductionOutput(String(result.stdout ?? ''))
  } catch (error) {
    return [`unreadable result: ${error instanceof Error ? error.message : String(error)}`]
  }
  return reproduction.check(output)
}

export function runMemoryAuditReproductions({
  reproductions = MEMORY_AUDIT_REPRODUCTIONS,
  spawnSyncImpl = spawnSync,
  log = console.log,
  logError = console.error
} = {}) {
  let failureCount = 0
  for (const reproduction of reproductions) {
    const script = reproductionScript(reproduction)
    const startedAt = Date.now()
    const result = spawnSyncImpl(process.execPath, [...reproduction.nodeFlags, script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, DOLPHIN_BACKGROUND_LAUNCH: '1' },
      timeout: REPRODUCTION_TIMEOUT_MS
    })
    const failures = evaluateReproduction(reproduction, result)
    const elapsed = `${Date.now() - startedAt}ms`
    if (failures.length === 0) {
      log(`PASS ${reproduction.audit} (${elapsed})`)
      continue
    }
    failureCount += 1
    logError(`FAIL ${reproduction.audit} (${elapsed})`)
    for (const failure of failures) {
      logError(`  - ${failure}`)
    }
  }
  return failureCount === 0 ? 0 : 1
}

if (process.argv[1] === import.meta.filename) {
  process.exit(runMemoryAuditReproductions())
}
