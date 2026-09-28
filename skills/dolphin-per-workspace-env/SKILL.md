---
name: dolphin-per-workspace-env
description: >-
  Set up, review, debug, or validate a Dolphin per-workspace environment recipe: the
  on-demand, disposable runtime (cloud sandbox, VM, SSH host, or local container)
  Dolphin creates fresh for each workspace. Use to stand up a new recipe end to end,
  fix an `environmentRecipes` entry in `dolphin.yaml`, scaffold provider lifecycle
  scripts, or resolve an `dolphin vm recipe doctor` failure. Use `dolphin-cli` for
  ordinary worktree and workspace creation with no recipe involved.
---

# Per-Workspace Environments

This discovery stub loads the version-matched guide from the Dolphin executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `DOLPHIN_CLI_COMMAND` environment variable is set, use its value. Dolphin exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `DOLPHIN_DEV_REPO_ROOT`, use `dolphin-dev`.
- Otherwise, on Linux outside a Dolphin-managed terminal, use `dolphin-ide`. Never run bare
  `dolphin` there — outside Dolphin's terminals it normally resolves to the
  KDE Dolphin file manager (`/usr/bin/dolphin`) and opens a window on the user's machine.
- Otherwise, use `dolphin`.

Below, `DOLPHIN` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `DOLPHIN` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Dolphin build.

## Load the version-matched guide before running Dolphin commands

```text
DOLPHIN skills get dolphin-per-workspace-env
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Dolphin is not running, start it with `DOLPHIN open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `DOLPHIN open` or restart Dolphin. If
`skills get` is unknown, explain that updating Dolphin restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
