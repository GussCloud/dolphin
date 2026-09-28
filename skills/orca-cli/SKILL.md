---
name: orca-cli
description: >-
  Operate Dolphin-managed worktrees, folder contexts, terminals, repos, automations, artifacts,
  skill sharing, worktree comments, and Dolphin's embedded browser through the `dolphin` CLI. Use
  when the user says "$orca-cli", "Dolphin worktree", "child worktree", "spawn codex/claude in a
  worktree", "read/wait/send Dolphin terminal", "handoff" / "handover" / "give this to another
  agent", "Dolphin browser", "dolphin artifacts", or "share skills". Prefer it over raw git
  worktree, ad hoc PTYs, or Computer Use when Dolphin state is involved. Use Computer Use only
  when a visible window needs GUI control that a CLI, filesystem, or API cannot do.
---

# Dolphin CLI

This discovery stub loads the version-matched guide from the Dolphin executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Dolphin exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `orca-dev`.
- Otherwise, on Linux outside a Dolphin-managed terminal, use `dolphin-ide`. Never run bare
  `dolphin` there — outside Dolphin's terminals it normally resolves to the
  KDE Dolphin file manager (`/usr/bin/dolphin`) and opens a window on the user's machine.
- Otherwise, use `dolphin`.

Below, `ORCA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ORCA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Dolphin build.

## Load the version-matched guide before running Dolphin commands

```text
ORCA skills get orca-cli
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Dolphin is not running, start it with `ORCA open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `ORCA open` or restart Dolphin. If
`skills get` is unknown, explain that updating Dolphin restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
