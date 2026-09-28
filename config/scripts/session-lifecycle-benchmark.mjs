#!/usr/bin/env node
// Long-running session benchmark against a running Dolphin, driven through its own CLI.
//
//   churn: create and close N terminals, then check counts return to baseline (roadmap scenario E)
//   soak:  sample diagnostics every --sample-sec for --minutes (scenarios A-D, G)
//
// Run: node config/scripts/session-lifecycle-benchmark.mjs churn --iterations 100 --worktree active
//      node config/scripts/session-lifecycle-benchmark.mjs soak --minutes 60 --sample-sec 30
// Set DOLPHIN_BENCHMARK_CLI to the dolphin executable (absolute path on Windows); defaults to `dolphin`.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { runProcessSync } from './script-child-process.mjs'
import {
  evaluateChurn,
  evaluateSoak,
  summarizeSample
} from './session-lifecycle-benchmark-report.mjs'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    iterations: { type: 'string', default: '100' },
    worktree: { type: 'string', default: 'active' },
    'settle-sec': { type: 'string', default: '20' },
    minutes: { type: 'string', default: '30' },
    'sample-sec': { type: 'string', default: '30' },
    'max-growth': { type: 'string', default: '0.1' },
    out: { type: 'string' }
  }
})
const scenario = positionals[0]
const cli = process.env.DOLPHIN_BENCHMARK_CLI ?? 'dolphin'

function dolphin(args) {
  const result = runProcessSync({ program: cli, args: [...args, '--json'], timeoutMs: 120_000 })
  if (result.code !== 0) {
    throw new Error(`dolphin ${args.join(' ')} failed (${result.code}): ${result.stderr.trim()}`)
  }
  return JSON.parse(result.stdout)
}

function unwrap(payload) {
  return payload?.result ?? payload
}

function sample() {
  return summarizeSample(unwrap(dolphin(['diagnostics', 'runtime'])))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runChurn() {
  const iterations = Number(values.iterations)
  const baseline = sample()
  console.log(`baseline: ${JSON.stringify(baseline)}`)
  for (let i = 1; i <= iterations; i++) {
    const created = unwrap(dolphin(['terminal', 'create', '--worktree', values.worktree]))
    const handle = created?.terminal?.handle
    if (!handle) {
      throw new Error(`terminal create returned no handle: ${JSON.stringify(created)}`)
    }
    dolphin(['terminal', 'close', '--terminal', handle, '--tab'])
    if (i % 10 === 0) {
      console.log(`cycle ${i}/${iterations}`)
    }
  }
  await sleep(Number(values['settle-sec']) * 1000)
  const after = sample()
  return { scenario: 'churn', iterations, baseline, after, verdict: evaluateChurn(baseline, after) }
}

async function runSoak() {
  const deadline = Date.now() + Number(values.minutes) * 60_000
  const samples = []
  while (Date.now() <= deadline) {
    const current = sample()
    samples.push(current)
    console.log(JSON.stringify(current))
    await sleep(Number(values['sample-sec']) * 1000)
  }
  return {
    scenario: 'soak',
    samples,
    verdict: evaluateSoak(samples, { maxGrowthRatio: Number(values['max-growth']) })
  }
}

if (scenario !== 'churn' && scenario !== 'soak') {
  console.error('usage: session-lifecycle-benchmark.mjs <churn|soak> [options]')
  process.exit(2)
}
const report = scenario === 'churn' ? await runChurn() : await runSoak()
if (values.out) {
  writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`)
}
console.log(JSON.stringify(report.verdict, null, 2))
process.exit(report.verdict.passed ? 0 : 1)
