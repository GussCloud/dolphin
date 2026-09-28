# Built-in browser commands

Use a snapshot-interact-re-snapshot loop:

```text
DOLPHIN goto --url https://example.com --json
DOLPHIN snapshot --json
DOLPHIN click --element @e3 --json
DOLPHIN snapshot --json
```

Common commands:

```text
DOLPHIN goto --url <url> --json
DOLPHIN back --json
DOLPHIN reload --json
DOLPHIN snapshot --json
DOLPHIN screenshot --json
DOLPHIN full-screenshot --json
DOLPHIN pdf --json
DOLPHIN click --element <ref> --json
DOLPHIN fill --element <ref> --value <text> --json
DOLPHIN type --input <text> --json
DOLPHIN select --element <ref> --value <value> --json
DOLPHIN check --element <ref> --json
DOLPHIN scroll --direction down --amount 1000 --json
DOLPHIN hover --element <ref> --json
DOLPHIN focus --element <ref> --json
DOLPHIN keypress --key Enter --json
DOLPHIN upload --element <ref> --files <paths> --json
DOLPHIN wait --text <text> --json
DOLPHIN wait --url <substring> --json
DOLPHIN wait --selector <css> --json
DOLPHIN wait --load networkidle --json
DOLPHIN eval --expression <js> --json
DOLPHIN tab list --json
DOLPHIN tab create --url <url> --json
DOLPHIN tab switch --index <n> --json
DOLPHIN tab close --index <n> --json
DOLPHIN cookie get --json
DOLPHIN capture start --json
DOLPHIN console --limit 50 --json
DOLPHIN network --limit 50 --json
DOLPHIN exec --command "help" --json
```

Browser rules:

- Re-snapshot after navigation, tab switches, clicks that change the page, and any `browser_stale_ref`.
- Refs like `@e1` are assigned by `snapshot`, scoped to one tab, and invalidated by navigation or tab switch.
- Browser commands default to the current worktree and its active tab. Use `--worktree all` only intentionally.
- For concurrent browser work, run `DOLPHIN tab list --json`, read `tabs[].browserPageId`, and pass `--page <browserPageId>` on later commands.
- Use typed tab commands (`DOLPHIN tab list/create/close/switch`), not `DOLPHIN exec --command "tab ..."`, so Dolphin keeps UI state synchronized.
- Prefer `wait --text`, `--url`, `--selector`, or `--load` after async page changes instead of bare timeouts.
- Anything not listed above goes through `DOLPHIN exec --command "<agent-browser command>"`.
- If `fill` or `type` fails on a custom input, try `DOLPHIN focus --element @e1 --json` then `DOLPHIN inserttext --text "text" --json`.
- A client-hosted page renders in the paired desktop's browser engine, so every command against it needs that desktop online and returns `browser_host_unavailable` while it is closed, asleep, or disconnected. Server-hosted pages run with no desktop attached; prefer them for long or unattended automation.

Common recoveries:

- `browser_no_tab`: open a tab with `DOLPHIN tab create --url <url> --json`.
- `browser_stale_ref`: run `DOLPHIN snapshot --json` and retry with fresh refs.
- `browser_tab_not_found`: run `DOLPHIN tab list --json` before switching or closing.
- `browser_host_unavailable`: the desktop hosting the page is offline. Bring it back, or recreate the page with server placement if the work must outlive the desktop session.
