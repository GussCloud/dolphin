# Autonomous goals

An autonomous goal is one coordinator agent driving an orchestration Run until the
objective is met. The user turns it on in the new-worktree composer ("Autonomous
work"), types the goal and picks the worker agent and how many worktrees may run at
once. Everything after that is the existing orchestration stack: Tasks with
dependencies, `worker-start --worktree new-top-level`, workers that open PRs and
drive them to green.

## The design constraint: tokens

The feature exists to run for hours on a subscription plan, so every recurring cost
is designed out:

- **No polling and no timers.** After dispatching, the coordinator ends its turn
  and idles. Run mail reaches it through mailbox pointer delivery (Dolphin types a
  notice into its terminal), so an idle goal costs nothing. `check --wait` is
  deliberately not used: a 15-minute wait loop re-sends the whole context on every
  timeout, and a turn that never ends leaves no safe point to rotate.
- **The coordinator never implements and never reads diffs or transcripts.** Workers
  report one or two lines plus a PR URL. CI and review traffic stay with the worker
  that owns the PR.
- **Rules live in one terse prompt** (`src/shared/autonomous-coordinator-prompt.ts`),
  not a large skill re-read every session.
- **Memory lives outside the context window.** The Run, its Tasks and the goal's
  notes are the only state that matters, so the session can be replaced at any turn
  end (see Rotation).

## Pieces

| Piece                                         | Where                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Goal record, statuses, notes                  | `src/shared/autonomous-goal-types.ts`                                                        |
| Per-host JSON store                           | `src/main/autonomous-goals/autonomous-goal-store.ts` (`userData/autonomous-goals.json`)      |
| `goal.start/note/complete/show/list/stop` RPC | `src/main/runtime/rpc/methods/autonomous-goals.ts`                                           |
| `dolphin goal …` CLI                          | `src/cli/specs/goal.ts`, `src/cli/handlers/goal.ts`                                          |
| Composer toggle                               | `NewWorkspaceComposerAutonomousSection.tsx`, `src/renderer/src/lib/autonomous-goal-draft.ts` |

The composer launches the coordinator through the normal quick-create path with
the coordinator prompt as its first message, pinned to the terminal surface. The
prompt's first command is `dolphin goal start`, which runs inside the coordinator's
own terminal: the caller's pane identifies the coordinator, and the goal and its Run
are created on the host that runs it, so SSH and local behave the same. The
objective travels as `--objective-b64` so no shell's quoting can mangle it.

A pane drives at most one open goal; repeating `goal start` returns it.

## Notes

`dolphin goal note --kind decision|handoff|blocker --text …` is the coordinator's
durable memory. Decisions accumulate up to `AUTONOMOUS_GOAL_MAX_DECISIONS`; a handoff
or a blocker replaces its predecessor. A blocker moves the goal to `blocked`; the
next decision or handoff moves it back to `active`.

## Rotation

`src/main/autonomous-goals/autonomous-goal-rotation.ts` replaces the agent's own
auto-compaction, which summarizes lossily and at an arbitrary point mid-task. On
each completed lead turn of a goal's coordinator pane:

1. Measure the context from the tail of the coordinator's own transcript
   (`autonomous-goal-context-probe.ts`): the newest Claude main-thread `usage`, or
   Codex's `token_count` with its stated window. No model call; at most 512 KB read.
   Rotate at `min(120k, 60% of a stated window)`. When the transcript lives on
   another host (SSH, WSL), rotate every 40 turns instead.
2. Paste a handoff request; the coordinator writes one `goal note --kind handoff`.
3. On its next turn end (or after 3 minutes), type `/clear` (Claude) or `/new`
   (Codex). The pane, its terminal handle and its Run binding survive; only the
   conversation is reset.
4. Paste a resume prompt built by code from the goal, its notes and the Run's
   Task table, never from a model summary, so nothing is lost or invented.

Rotation backs off if the user typed into the pane, never fires twice inside 10
minutes, and skips a usage-limited goal.

## Plan quota

Budgets in money do not protect a subscription plan, so the guard reads the
plan windows Dolphin already tracks (`RateLimitService`, no extra polling):

- `orchestration.workerStart` for a Run that belongs to an open goal is refused
  with `goal_usage_limited` when the coordinator's or the workers' plan is at
  85% of its 5-hour window or 95% of its weekly window. The goal moves to
  `usageLimited` with `usageResumeAt` = the window's reset (or 30 minutes when
  no reset time is known). Workers already running are left alone.
- `autonomous-goal-usage-resume.ts` arms a timer per usage-limited goal from the
  stored `usageResumeAt`, so it survives an app restart. A minute after the reset
  it marks the goal `active` and pastes one notice into the coordinator pane.
- Rotation skips a usage-limited goal: waking it to rotate would spend the quota
  the pause is saving.

A host with no usage data (headless, signed out) never blocks.

## Visibility

- `AutonomousGoalStrip` shows one line above the worktree's panes while its
  coordinator drives an open goal: status, objective (or the open blocker),
  rotation count and a Stop button. It refreshes every 30 seconds only while a
  goal is shown and the window is visible.
- `autonomous-goal-notifier.ts` raises an `autonomous-goal` notification on each
  transition into `complete`, `blocked` or `usageLimited`. It goes through the
  normal delivery service (desktop and paired mobile), gated by the
  agent-task-complete setting, and is seeded from stored state so a restart does
  not re-announce old outcomes.

## Statuses

`active`, `usageLimited`, `blocked` are open; `complete` and `stopped` are closed.
Stopping a goal leaves its Run, Tasks and workers untouched.

## Supported agents

Coordinators and workers are Claude, Claude Agent Teams or Codex
(`AUTONOMOUS_GOAL_AGENTS`). Each maps to the CLI it runs
(`AUTONOMOUS_GOAL_AGENT_CLI`), and that CLI decides the transcript format the
context probe reads, the hook source rotation listens to, the in-place reset
(`/clear` for Claude and Agent Teams, `/new` for Codex) and the plan the usage guard
checks: an Agent Teams goal draws on the Claude plan.

- An Agent Teams coordinator is told not to spawn teammates: parallel work goes
  through orchestration workers, whose state survives a session reset, while a
  teammate's context would be lost on `/clear`. Rotation never fires while
  teammates are still working, because the leader's row then reads `working`.
- An Agent Teams worker may split its own Task across teammates; it alone opens
  the PR and reports `worker_done`.
- DeepSeek is not offered yet: its launch gate and isolated config are not wired
  into goal workers.
