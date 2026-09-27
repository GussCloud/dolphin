# Storage GC

`orca gc` reclaims disk held by terminal session history. That history lives in `userData/terminal-history/<encoded session id>/`, which holds `output.log`, `checkpoint.json`, `meta.json`, and `scrollback.bin`.

Before `orca gc` existed, a session tree was only removed on an explicit kill without `keepHistory`. A session that exited on its own, crashed, or outlived its daemon kept its tree forever.

## What is never removed

These checks live in `planTerminalHistoryGc` and hold under every policy:

| Kept because | How it is known |
|---|---|
| `live-in-daemon` | Listed alive by a daemon adapter |
| `referenced-by-saved-tab` | Its id appears anywhere in a persisted workspace session, on any host, so a saved tab can still cold-restore it |
| `recovery-protected` | A recovery freeze is open, or `.unreadable-recovery` marks a failed quarantine |
| `recently-active` | Touched within 24 hours, so a spawn racing the scan is safe |

If any daemon adapter fails to list its sessions, or no daemon is running, nothing is removed and the result carries `refusedReason: 'daemon-inventory-incomplete'`. A session that cannot be proven gone is treated as live.

## Policy

Defaults are 30 days and 5 GB. Eligible trees older than `--older-than` go first. After that, the oldest eligible trees go until the total fits under `--max-size`. The RPC defaults to a dry run unless `dryRun: false` is sent explicitly. The CLI removes unless `--dry-run` is passed.

Removal goes through `removeTerminalHistorySessionTrees`: a tombstone rename followed by an async removal. A quit in the middle of removal therefore finishes on the next launch.

## Out of scope

- **Per-worktree shell HISTFILE directories.** `terminal-history-gc.ts` already collects them when their worktree is gone.
- **Codex session files under `codex-runtime-home`.** They are hardlinks into the user's own `~/.codex/sessions`, so unlinking them frees nothing while the original exists. `orca diagnostics runtime` reports their size without double-counting.
