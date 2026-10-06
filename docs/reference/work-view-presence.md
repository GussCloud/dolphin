# Work view: agent presence from desktop to console

The console's work view ("Escritório dos agentes") shows, in real time, every member of a corporate organization whose Dolphin app is running, the projects they have open and the agents working in them. It is display-only: nothing on it changes an agent or a terminal.

## Domain

```
Organization (corg_*)
  Dev        = organization member (user account), one room
    Project  = repository, one block of desks; ids are scoped per machine
      Agent  = one agent pane (CLI + worktree), one desk
```

There is no "you" room: the viewer's own account is just another dev.

Membership comes from the existing Azure DevOps auto-link (`dolphin-org-link.ts` → `joinOrganization`). Presence never creates membership; a desktop whose account belongs to no corporate organization is told so and backs off.

## Privacy boundary

Only these fields leave the machine: repository display name, branch, agent CLI (`agentType`), mapped state, the machine's hostname, and opaque ids. Never prompts, tool input, assistant messages, paths, or titles. Ids are SHA-256 hashes (hex, first 16 chars) of the local ids, so a pane key or repo path is never sent.

## State mapping (desktop)

| `AgentStatusEntry.state` | Work view `state` |
| --- | --- |
| `working` | `working` |
| `blocked`, `waiting` | `permission` |
| `done` | `idle` |

Rows the agent status store would not display (decayed, `restoredUnconfirmed`, `exited`) are left out; an `unverifiable` SSH row is kept with its last state.

## Desktop → auth API

All requests use the desktop cloud session's Bearer access token against the API host.

### `PUT /v1/desktop/work-presence`

Full snapshot of one machine, idempotent. Sent on change (debounced ~1 s) and as a heartbeat every `heartbeatMs` returned by the server (default 20 s).

```json
{
  "schemaVersion": 1,
  "machineId": "3f9a…",            // stable per install+profile, opaque
  "machineLabel": "marina-mbp",    // os.hostname(), max 64 chars
  "projects": [
    {
      "id": "a1b2…",               // hash(repoId)
      "name": "dolphin",           // repo displayName, max 80
      "agents": [
        { "id": "c3d4…", "cli": "claude", "state": "working", "branch": "feat/pix" }
      ]
    }
  ]
}
```

Limits: ≤ 50 projects, ≤ 100 agents per machine; `branch` nullable (folder workspaces), max 120 chars.

Responses:
- `200 { "organizationId": "corg_…", "heartbeatMs": 20000 }`
- `404 { "error": "no_organization" }`: the account is in no corporate org; retry after 10 minutes.
- `401`: refresh the session through the existing session flow, then retry.

### `DELETE /v1/desktop/work-presence?machineId=…`

Sent on graceful quit or sign-out. The room leaves immediately with the goodbye animation.

## Liveness (auth server)

Presence is held in memory (one auth instance). For each machine:
- No snapshot for 60 s (three missed heartbeats): the machine is `offline`. Every online / offline / back online / dropped / goodbye transition is logged as `[work-presence]`. A dev whose machines are all offline is drawn greyed with "sem sinal".
- 120 s more without a snapshot: the machine is dropped, and the room plays the goodbye and closes once no machine is left.
- A new snapshot at any time revives it.

## Console → browser

- `GET /console/office`: the work view page for a signed-in member.
- `GET /console/office/stream`: Server-Sent Events for a signed-in member.
- `GET /console/tv/:token` and `GET /console/tv/:token/stream`: the same view for a display link, with no sign-in. The owner creates and revokes display links on the work view page; only the token hash is stored.

The stream sends `event: snapshot` with the whole org view, at most every 500 ms, plus a keepalive comment every 15 s:

```json
{ "devs": [ { "id": "usr_…", "name": "Marina", "machines": ["marina-mbp"], "status": "online",
  "projects": [ { "id": "<machineId>:<projectId>", "name": "dolphin",
    "agents": [ { "id": "<machineId>:<agentId>", "cli": "claude", "state": "working", "branch": "feat/pix" } ] } ] } ] }
```

The browser diffs consecutive snapshots into the office engine (`upsert*` / `remove*`). Speech bubbles show only real transitions, never invented phrases.
