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

- **The agent never polls.** After dispatching, the coordinator ends its turn
  and idles. Run mail reaches it through mailbox pointer delivery (Dolphin types a
  notice into its terminal), so an idle goal costs no tokens. The host's own
  timers (stranded mail, cleanup) only read local state and type nothing unless
  something is stuck. `check --wait` is
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
are created on the host that runs it, so SSH and local behave the same.

The launch prompt is typed into the terminal's shell as an argv argument, so it is
one line of shell-inert characters: it only says to run `goal start` (the objective
travels as `--objective-b64`). The rules come back in `goal start`'s `instructions`
field and reach the model as tool output. Windows PowerShell 5.1, the default
Windows terminal shell, drops embedded double quotes when it calls a native program,
and cmd.exe ends a command at a newline, so the first versions, which put the
multi-line rules in argv, launched Claude on Windows without a usable prompt.
`autonomous-coordinator-launch.win32.test.ts` runs the real launch line through
both shells on the Windows CI lane.

A pane drives at most one open goal; repeating `goal start` returns it.

## Claude's folder trust dialog

Claude Code asks once per folder whether to trust it, and a new worktree is a new
folder. Two things keep that dialog from stalling a goal:

- The coordinator's prompt goes in the launch command (argv), never typed after
  start: Claude reads argv after the dialog is answered, while typed text lands in
  the dialog and is lost. Claude Agent Teams uses argv for every launch for the
  same reason.
- For goal worktrees only, the host pre-accepts the dialog before the agent
  starts (`autonomous-goal-claude-trust.ts`): it sets
  `projects[<path>].hasTrustDialogAccepted` in the config the agent reads (the
  Claude config, or `~/.claude-deepseek/.claude.json` for DeepSeek), under the same
  `<config>.lock` Claude itself takes. The composer marks the coordinator's create
  (`autonomousGoalWorkspace`); `worker-start` marks a worker's create when its Run
  belongs to an open goal. Every other worktree still shows the dialog.

A worker's task brief is pasted into its terminal and submitted with Enter. A
composer drawn before Enter is live can drop that first Enter (seen with Claude on
Windows: the brief sat in the composer). When no turn has started
`verifiedSubmitRetryMs` (3 s for every Claude Code agent) after the Enter, the
main-process prompt writer sends one more Enter and records `submitRetried` on the
dispatch receipt. It skips the retry if the user typed into the pane, the agent is
asking for permission, or the process changed; an extra Enter on Claude's empty
composer is a no-op. This applies to every main-process prompt send, not only goals.

Not covered: SSH and WSL worktrees, whose agent reads a config on another host;
there the dialog still appears.

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

## Stranded Run mail

The coordinator never polls, so the mailbox pointer is its only wake signal, and
the pointer path has two silent holes: it types nothing while a delivery is
checked but unacked (`mailbox-pointer-delivery.ts`), and it never re-sends a
pointer whose single Enter was dropped. Two things close them:

- The coordinator rules say an ack response can carry the next batch, which
  must be handled and acked too. An unhandled batch was the usual trigger: two
  workers finishing close together left the second batch pending forever.
- `autonomous-goal-mail-watchdog.ts` reads the Run mailbox every 30 s (a local
  DB read, no model call). Mail unread for 60 s while the coordinator is idle
  gets one short nudge, typed through the verified prompt path (Enter re-sent
  once if no turn starts). It waits again if the user typed into the pane,
  re-nudges at most every 5 minutes, skips usage-limited goals, and after 3
  unanswered nudges marks the goal blocked so the user is notified.

## Worker brief delivery

A worker starts the way the coordinator does: its first message rides the
agent's launch command, so Dolphin types nothing into the pane and no Enter can
be dropped.

Why: on Windows, Claude often drops the first Enter after a paste into a freshly
started composer. Pasted worker briefs passed `observationTimeoutMs: 0`, which
also skipped the verified Enter retry, so every worker waited for a manual
Enter. Removing line breaks (0.2.28) changed nothing; they were never the cause.

- **Launch** (`worker-brief-launch.ts`): `worker-start` puts a one-line
  `startupPrompt` on the terminal it creates. The line is the typed lead line
  plus `... run \`dolphin orchestration worker-brief --dispatch <id> --json\` and
  follow the brief it returns`. The CLI name comes from the worktree's host
  (`getWorktreeOrchestrationCliCommand`), since no terminal exists yet. This
  holds for plain argument agents only (`argv`, `--prompt`): Claude, Agent
  Teams, Codex and DeepSeek. Antigravity and Hermes keep the paste.
- **Brief:** once the terminal has a pane identity, the start mints the
  capability and holds the brief on the host (`worker-brief-store.ts`).
  `worker-brief` returns it only to that pane, so the capability never shows up
  in scrollback. A worker that asks first waits up to 30 s while its dispatch is
  still `starting`.
- **Readiness** is the fetch, not an idle prompt: an agent busy on its launch
  prompt never reads idle. The idle read still runs alongside it, so a login,
  update or trust screen, or an exited terminal, fails the start at once, and a
  gated setup records its outcome as before. A worker that never fetches within
  the window settles `outcome_unknown`, never `failed`.
- **Memory only:** the brief does not survive a host restart. A worker that
  asks afterwards gets `worker_brief_not_found`, and the coordinator dispatches
  it again.
- **Paste paths:** a reused terminal (`--terminal`) and `dispatch --inject`
  still paste the pointer. Their queued receipt now re-sends Enter 3 s, 8 s and
  18 s after the first (`retryUnstartedQueuedPromptSubmit`). It stops at a turn
  start, a permission prompt, a replaced process, or any user typing. Tests of
  this path must use `dispatchPreambleSendOptions`: a test without
  `observationTimeoutMs: 0` passed while the real path never retried.

## Cleanup

`autonomous-goal-cleanup.ts` leaves nothing running or on disk once the work is
done. It reuses the existing verbs, never forced:

- A worker that settles (succeeded or failed) has its terminal and agent
  process released at once (`orchestration.workerRelease`).
- A succeeded worker's worktree is removed (`worktree.rm`) once its PR/MR is
  merged, checked through `hostedReview.forBranch` at most every 5 minutes per
  worktree. Until then the worker may still be driving CI.
- When the goal closes, every settled worker's worktree goes, failed ones too.
  The coordinator's own worktree is kept unless the goal asked to remove it;
  then it follows 30 s after `complete`, so its closing reply is not cut off.
  It is always kept on `stop`. The sweep survives a restart
  (`cleanup.finishedAt`).
- The composer sets both choices: "Remove worktrees when done" (on by default)
  and, while it is on, "Keep main worktree" (on by default). They ride the
  coordinator's launch prompt as `goal start --keep-worktrees` and
  `--remove-coordinator-worktree`, and only when they differ from the defaults,
  so a host without the flags still accepts a default launch. The goal stores
  them as `removeWorktrees` / `keepCoordinatorWorktree`, and an absent field
  means the default. With removal off, nothing is released or removed: worker
  terminals, agents and worktrees all stay for the user.
- Removal is never forced: uncommitted changes keep a worktree, and a branch
  whose work is not integrated is kept by `worktree.rm`. What was removed and
  what was kept, with the reason, is stored on the goal (`cleanup`) and shown
  by `dolphin goal show`.

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
Stopping a goal leaves its Run and Tasks untouched; settled workers are cleaned up
(see Cleanup) and running ones keep running.

## Supported agents

Coordinators and workers are Claude, Claude Agent Teams, Codex, DeepSeek or
DeepSeek Agent Teams (`AUTONOMOUS_GOAL_AGENTS`). Each maps to the CLI it runs
(`AUTONOMOUS_GOAL_AGENT_CLI`): DeepSeek runs the Claude Code CLI against DeepSeek's
API (see [`deepseek-agent.md`](./deepseek-agent.md)). The CLI decides the transcript
format the context probe reads, the hook source rotation listens to and the in-place
reset (`/clear` for every Claude Code agent, `/new` for Codex).

The plan the usage guard checks is separate (`AUTONOMOUS_GOAL_AGENT_PLAN`): Agent
Teams draws on the Claude plan; DeepSeek is API-billed, has no window, and is never
paused by the guard. DeepSeek's Claude-format transcript states no context window,
so its coordinator rotates at 64k tokens (its chat models have a 128k window)
instead of 120k.

- An Agent Teams coordinator (Claude or DeepSeek) is told not to spawn teammates:
  parallel work goes through orchestration workers, whose state survives a session
  reset, while a teammate's context would be lost on `/clear`. Rotation never fires
  while teammates are still working, because the leader's row then reads `working`.
- An Agent Teams worker is launched with the Agent Teams session instructions
  from Settings (`--append-system-prompt`, through the same startup builder as a
  normal launch). The coordinator's rules make every worker spec tell it to split
  the Task across teammates; the worker alone opens the PR and reports
  `worker_done`.
- DeepSeek never runs over SSH (its key would cross the relay), so a DeepSeek goal
  on an SSH workspace fails at launch like any DeepSeek launch there.
