# Automations

An automation is a scheduled Dolphin prompt run by a chosen provider against either a repo-created worktree or an existing workspace.

```text
DOLPHIN automations list --json
DOLPHIN automations show <automationId> --json
DOLPHIN automations create --name "Daily review" --trigger daily --time 09:00 --prompt "Review open changes" --provider codex --repo id:<repoId> --json
DOLPHIN automations create --name "Weekday triage" --trigger "0 9 * * 1-5" --prompt "Triage issues" --provider claude --repo path:/abs/repo --disabled --json
DOLPHIN automations create --name "Inbox digest" --trigger hourly --prompt "Summarize unread mail" --provider codex --workspace active --reuse-session --json
DOLPHIN automations edit <automationId> --trigger weekdays --time 09:30 --fresh-session --json
DOLPHIN automations run <automationId> --json
DOLPHIN automations runs --id <automationId> --json
DOLPHIN automations remove <automationId> --json
```

Schedules accept `hourly`, `daily`, `weekdays`, `weekly`, 5-field cron, or RRULE. Use `--time <HH:MM>` with `daily`/`weekdays`/`weekly`, and `--day <0-6>` only with `weekly` where Sunday is `0`.

Use `--repo <selector>` for a new worktree per run, or `--workspace <selector>` / `--workspace-mode existing` for an existing Dolphin worktree. `--repo` and `--workspace` are mutually exclusive. Use `--reuse-session` only for existing-workspace automations; if the previous terminal is gone, Dolphin falls back to a fresh session. Prefer `--disabled` while testing setup.
