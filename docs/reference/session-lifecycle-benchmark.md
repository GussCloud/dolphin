# Session lifecycle benchmark

`config/scripts/session-lifecycle-benchmark.mjs` drives a running Dolphin through its own CLI and judges the result with `dolphin diagnostics runtime --json`. It measures the long-running classes of failure: leaked PTYs, orphaned processes, and unbounded memory growth.

Set `DOLPHIN_BENCHMARK_CLI` to the `dolphin` executable, using an absolute path on Windows. Every run exits `1` when its verdict fails. `--out <file>` writes the full report.

## Scenarios

| Roadmap scenario              | Command                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| A: baseline, no agents        | `soak --minutes 30` with no terminals open                     |
| B / C / D: 1, 5, or 10 agents | Start the agents, then `soak --minutes 30` (or `60`, or `360`) |
| E: churn                      | `churn --iterations 100 --worktree <selector>`                 |
| G: long-running               | Start 10 agents, then `soak --minutes 1440`                    |

Scenario F (disconnect and reconnect) needs a paired client and is still manual. Toggle the connection 20 times, then run `dolphin diagnostics runtime`. A healthy run shows no `daemon-session-orphaned` and no new inconsistencies.

## Verdicts

- **churn:** after the cycles and a settle wait (`--settle-sec`, default 20), these must be back at or below baseline:
  - tracked PTYs
  - daemon sessions
  - orphaned sessions
  - processes in session trees
  - untracked daemon descendants

  Memory deltas are reported but not judged, because allocator high-water marks are expected.

- **soak:** memory growth of renderer, main, and daemon from the first post-warm-up sample to the last must stay under `--max-growth` (default `0.1`). Orphaned sessions and untracked daemon descendants must not grow.

The 10% threshold is the roadmap's starting point. Calibrate it once a baseline run exists on each platform.
