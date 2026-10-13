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

Only these fields leave the machine: repository display name, branch, agent CLI (`agentType`), mapped state, the machine's hostname, an optional agent display name, and opaque ids. Never prompts, tool input, assistant messages, or paths. Ids are SHA-256 hashes (hex, first 16 chars) of the local ids, so a pane key or repo path is never sent.

The agent display name (`name`) comes from names set by the user, agents or automation, in this order:

1. the Claude Agent Teams teammate name (`impl`, `review`), which Claude sets with `tmux select-pane -T` on a teammate pane; the leader pane never takes one. The lead model chooses these names from the task, so they can describe the work;
2. the terminal tab's `customTitle`. It is not only a manual rename: `terminal create --title` and `terminal rename` (used by agents and orchestration), automations and worktree templates set it too, so it can also carry task-derived text;
3. the tab's quick-command label (`quickCommandLabel`).

Otherwise `name` is omitted and the browser numbers the agent ("Claude 1"). Generated tab titles, AI-vault titles and live terminal titles are never sent, because they are derived from prompts or program output. A tab-level name labels every pane of a split tab; teammate panes are splits in the leader's tab, so the teammate name wins per pane. Control and bidi override/isolate characters are replaced and the name is capped at 60 characters.

Every viewer of the work view sees these names, **including anyone holding a display (TV) link, which needs no sign-in**. Whatever text a teammate name or `customTitle` carries, task-derived or not, is published to the organization and to every active TV link.

A name change is not published on its own: it reaches the console with the next snapshot, sent on the next status change or heartbeat (at most ~20 s).

Teammate names are known only for teams whose tmux shim talks to this desktop's runtime. Teammates running in-process (no panes), and teams whose shim is routed to a paired remote runtime (`DOLPHIN_PAIRING_CODE` / `DOLPHIN_ENVIRONMENT`), fall back to the tab name.

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
        { "id": "c3d4…", "cli": "claude", "state": "working", "branch": "feat/pix", "name": "impl" },
        { "id": "e5f6…", "cli": "codex", "state": "idle", "branch": "feat/pix" }   // unnamed: no "name"
      ]
    }
  ]
}
```

Limits: ≤ 50 projects, ≤ 100 agents per machine; `branch` nullable (folder workspaces), max 120 chars; `name` optional, sent trimmed and at most 60 chars (a blank one is treated as absent).

`name` was added under `schemaVersion: 1` without a bump: it is optional, its absence already means "unnamed", and the server never branches on the version. An older server strips it; an older desktop never sends it.

Forward compatibility (desktops and the auth server update independently, see [remote-wire-compatibility.md](./remote-wire-compatibility.md)):
- `schemaVersion` is any integer ≥ 1. A later version may only add fields; the server strips fields it does not know and reads the v1 ones. A change that alters or removes a v1 field needs a new route, not a version bump.
- An agent `state` the server does not know (any string up to 40 chars) is shown as `idle` rather than rejecting the snapshot, so a newer desktop never greys its room. Adding a state therefore means updating the server first and the desktop mapping second.
- A `name` longer than 60 chars (any string up to 200) is truncated to 60 rather than rejecting the snapshot; over 200 is invalid.
- Anything else outside the limits above still rejects the whole snapshot with `400 { "error": "invalid_request" }`.

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
    "agents": [ { "id": "<machineId>:<agentId>", "cli": "claude", "state": "working", "branch": "feat/pix", "name": "impl" } ] } ] } ] }
```

The browser diffs consecutive snapshots into the office engine (`upsert*` / `remove*`). Speech bubbles show only real transitions, never invented phrases.

### Views: doors, room, TV rotation

The page opens on **doors**: a hallway with one door per dev, fitted to the viewport (`pickDoorGrid` in `office-fit.js`). Each nameplate shows the dev's name and agent count, and the lamp above the door is amber if any agent is waiting for approval (highest priority, so an approval is never hidden behind a closed door), else green if any agent is working, else grey (idle or no signal; offline doors are greyed).

Clicking a door opens that dev's **room** with the usual scene. `← Salas` or `Esc` goes back; if the open dev leaves the snapshot, the view returns to the doors. Every room keeps simulating while the doors are shown, so agents are already seated when a room opens. The zoom buttons only apply to a room.

The **TV page** rotates on its own: doors for 10 s, then each room for 12 s with a 2.5 s doors break in between. Rooms with an agent awaiting approval go first, and offline devs with no agents are skipped. The queue is rebuilt each cycle, and the timings are constants at the top of `office-client.js`. Clicks are disabled on the TV; the console page, including fullscreen, stays manual.

Agent names use the optional `name` field when the stream sends it, otherwise "Claude 1", "Claude 2"... Two agents of the same dev with the same visible name get " 2", " 3" suffixes, stable while the agent lives.
