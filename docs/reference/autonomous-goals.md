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

- **No polling and no timers.** The coordinator blocks in
  `dolphin orchestration check --wait`; an idle goal costs nothing.
- **The coordinator never implements and never reads diffs or transcripts.** Workers
  report one or two lines plus a PR URL. CI and review traffic stay with the worker
  that owns the PR.
- **Rules live in one terse prompt** (`src/shared/autonomous-coordinator-prompt.ts`),
  not a large skill re-read every session.
- **Memory lives outside the context window.** The Run, its Tasks and the goal's
  notes are the only state that matters, so the session can be replaced at any turn
  end.

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

## Statuses

`active`, `usageLimited`, `blocked` are open; `complete` and `stopped` are closed.
Stopping a goal leaves its Run, Tasks and workers untouched.

## Supported agents

Coordinators and workers are Claude or Codex: rotation resets the session in place
(`/clear`, `/new`), which these two CLIs support.
