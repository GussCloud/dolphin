# Terminal session lifecycle

One vocabulary for where a terminal session is in its life, shared by main, the daemon, and diagnostics. It is defined in `src/shared/session-lifecycle.ts`.

## Identity

A session id outlives its process. Cold restore and reattach bind a new runtime (a new daemon `incarnationId`, a new PID) to the same id. Never treat a PID as the session.

## States

`creating → starting → running ⇄ idle → stopping → terminated → reaped`

Auxiliary states: `restoring`, `disconnected`, `orphaned`, `failed`.

- `terminated` never returns to `running`. A restore goes through `restoring`, which starts a new runtime under the same id.
- A repeated transition to the same state is a no-op. This keeps repeated stop calls idempotent.
- A forbidden transition is refused and counted. It never throws. A nonzero `rejectedLifecycleTransitions` in `orca diagnostics runtime` means two layers disagree about a session.

## Who records what

| Layer | Source | States |
|---|---|---|
| Main (local PTYs) | `SessionLifecycleLedger` fed by `memory/pty-registry.ts` | `running` on register, `stopping` in `shutdownProviderAndDetectExit`, `terminated` then `reaped` on unregister |
| Daemon | `SessionInfo.state` via `projectDaemonSessionLifecycle` | `running`, `exiting` (projected to `stopping`) while a kill is in flight, `exited` |
| Daemon log (`daemon.log`) | `daemon-file-log.ts` | `session-created`, `session-stop-requested`, `session-killed`, `session-exited`, `session-reaped`, and `process-orphan-{suspected,reaped,confirmed,unverifiable}` |

The ledger keeps the 200 most recently reaped sessions, so diagnostics can show recent teardowns. Anything older is dropped.

## Descendants that survive a kill

A kill's descendant sweep sends SIGTERM, then SIGKILL, then re-reads the process table. When a descendant is still observed (`live`), `confirmShutdownDescendantSurvivors` handles it in three steps:

1. It logs `process-orphan-suspected`.
2. It waits 10s, then re-runs the sweep on the same snapshot. The re-run re-checks each process's start time and pgid before signalling, so a reused PID is never touched.
3. It logs the result: `process-orphan-reaped`, `-confirmed`, or `-unverifiable`.

This only runs on POSIX. On Windows the per-PTY job object owns the tree.

## Rules for new code

- Record a transition where the fact is observed. Do not infer it from a process existing. Following [`ssh-execution-boundary.md`](./ssh-execution-boundary.md), loss of contact is `disconnected`, never `terminated`.
- A finding is a suspect until confirmed. Diagnostics report inconsistencies; only a reaper that re-confirms may act on them.
