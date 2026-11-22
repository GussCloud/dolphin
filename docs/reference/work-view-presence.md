# Work view: agent presence from desktop to console

The console's work view ("Escritório dos agentes") shows, in real time, every member of a corporate organization whose Dolphin app is running, the projects they have open and the agents working in them. It is display-only: nothing on it changes an agent or a terminal.

## Domain

```
Organization (corg_*)
  Dev        = organization member (user account), one card / one tree
    Project  = repository, one branch of the tree; ids are scoped per machine
      Agent  = one agent pane (CLI + worktree), one leaf
```

There is no "you" card: the viewer's own account is just another dev.

Membership comes from the existing Azure DevOps auto-link (`dolphin-org-link.ts` → `joinOrganization`). Presence never creates membership; a desktop whose account belongs to no corporate organization is told so and backs off.

## Privacy boundary

Only these fields leave the machine: repository display name, branch, agent CLI (`agentType`), mapped state, the machine's hostname, an optional agent display name, and opaque ids (including an optional lead link, `parentId`). Never prompts, tool input, assistant messages, or paths. Ids are SHA-256 hashes (hex, first 16 chars) of the local ids, so a pane key or repo path is never sent.

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
        { "id": "c3d4…", "cli": "claude", "state": "working", "branch": "feat/pix", "name": "impl", "parentId": "e5f6…" },
        { "id": "e5f6…", "cli": "codex", "state": "idle", "branch": "feat/pix" }   // unnamed: no "name"
      ]
    }
  ]
}
```

`parentId` (optional) is the `id` of the agent that leads this one in the same project: the explicit orchestration parent (`parentPaneKey`, the coordinator) first, else the Claude Agent Teams leader (`getClaudeAgentTeamLineageByPaneKey`), the same precedence as the app sidebar's `resolveAgentRowParentPaneKey`. It is sent only when the lead is in the same project and survived the agent cap; it is hashed like every id, so no pane key leaves the machine. Teammates without a pane-level lineage (in-process teams, teams on a paired remote runtime) are sent without it.

Limits: ≤ 50 projects, ≤ 100 agents per machine; `branch` nullable (folder workspaces), max 120 chars; `name` optional, sent trimmed and at most 60 chars (a blank one is treated as absent).

`name` was added under `schemaVersion: 1` without a bump: it is optional, its absence already means "unnamed", and the server never branches on the version. An older server strips it; an older desktop never sends it.

Forward compatibility (desktops and the auth server update independently, see [remote-wire-compatibility.md](./remote-wire-compatibility.md)):
- `schemaVersion` is any integer ≥ 1. A later version may only add fields; the server strips fields it does not know and reads the v1 ones. A change that alters or removes a v1 field needs a new route, not a version bump.
- An agent `state` the server does not know (any string up to 40 chars) is shown as `idle` rather than rejecting the snapshot, so a newer desktop never greys its dev. Adding a state therefore means updating the server first and the desktop mapping second.
- A `name` longer than 60 chars (any string up to 200) is truncated to 60 rather than rejecting the snapshot; over 200 is invalid.
- A `parentId` that is not a valid id (any string up to 200 chars) is dropped rather than rejecting the snapshot; the agent is then shown at the top level. Like `name`, it was added under `schemaVersion: 1`.
- Anything else outside the limits above still rejects the whole snapshot with `400 { "error": "invalid_request" }`.

Responses:
- `200 { "organizationId": "corg_…", "heartbeatMs": 20000 }`
- `404 { "error": "no_organization" }`: the account is in no corporate org; retry after 10 minutes.
- `401`: refresh the session through the existing session flow, then retry.

### `DELETE /v1/desktop/work-presence?machineId=…`

Sent on graceful quit or sign-out. The dev leaves the view with the next snapshot.

## Liveness (auth server)

Presence is held in memory (one auth instance). For each machine:
- No snapshot for 60 s (three missed heartbeats): the machine is `offline`. Every online / offline / back online / dropped / goodbye transition is logged as `[work-presence]`. A dev whose machines are all offline is drawn greyed with "sem sinal".
- 120 s more without a snapshot: the machine is dropped, and the dev leaves the view once no machine is left.
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

The browser redraws the view from each snapshot; agent names stay stable between snapshots (`createAgentNamer` in `office-model.js`).

### Views: macro, detail, TV rotation

Scripts: `office-model.js` (rules with no DOM, unit-tested in `office-model.test.ts`), `office-view.js` (DOM, built with `textContent` so stream strings never become markup) and `office-client.js` (stream, navigation, rotation).

The page opens on the **macro view**: one card per dev with the online / no-signal status, machines, counts of working / awaiting approval / idle agents, and each project with one dot per agent. The awaiting-approval count turns amber when it is above zero.

Clicking a card, or **Detalhada**, opens that dev's **tree**: the dev on top, the projects side by side below, and each project's agents side by side below it, with each agent's sub-agents (`parentId`, nested by `nestAgents`) below their lead, joined by SVG cables. A broken or cyclic lead link never hides an agent: it is shown at the top level. A cable runs fast and amber toward an agent awaiting approval, flows in the project's color toward a working one, and is still and grey toward an idle one; a project's cable takes its most urgent agent's state. The tree stays on one row and scales down to fit (never under 70%, `fitScale`), then scrolls sideways inside its own area; under 768 px it becomes an indented list. Tabs switch devs; `← Visão macro` or `Esc` goes back, and if the open dev leaves the snapshot the view returns to the macro view. Clicking a dev or an agent opens a side panel with its details.

**Rotation** (macro for 10 s, then each dev for 12 s; devs with an approval waiting first, offline devs with no agents skipped, queue rebuilt each cycle) is **off by default on both the console and the TV page**. The *Rotação automática* switch turns it on, and that choice is kept in the browser's `localStorage` (`dolphin.office.rotation`), so a wall display is set up once. The TV page is clickable like the console.

### Profile pictures

Each dev's avatar is a picture or their initials, stored per user in `user_avatars` (`user-avatar-store.ts`):

- **Azure DevOps**: captured on every Azure DevOps sign-in or org link from the desktop (`azure-devops-sign-in-routes.ts`, `azure-devops-link-routes.ts`) with the token the desktop just sent, which is never stored. Graph identity id → subject descriptor → avatar (`vssps.dev.azure.com/{org}/_apis/graph/descriptors/{id}`, then `…/graph/Subjects/{descriptor}/avatars`, scope `vso.graph`; `azure-devops-avatar.ts`). The capture runs after the response is sent and only logs `[avatar] … reason=` on failure, so sign-in never waits on or fails for it. Only PNG, JPEG, GIF or WebP up to 256 KB, recognised by their first bytes, are kept: an SVG served from the console's origin could run script. A PAT without the Graph (Read) scope gets no picture.
- **GitHub**: the member types their login (GitHub's own login rule); the picture route redirects to `https://github.com/<login>.png?size=160`, so viewers' browsers, TV displays included, load it from GitHub.
- **Initials**: the default.

A member never chosen gets the Azure DevOps picture once one is captured, else initials; a choice made in the *Sua foto no escritório* card on the work view page always wins. Pictures are served by `GET /console/office/avatars/:userId` (signed-in members) and `GET /console/tv/:token/avatars/:userId` (display links), only for members of that organization. The view carries `avatarVersion` per dev when there is a picture, and the browser keeps the initials underneath so a picture that fails to load just disappears.

Agent names use the optional `name` field when the stream sends it, otherwise "Claude 1", "Claude 2"... Two agents of the same dev with the same visible name get " 2", " 3" suffixes, stable while the agent lives.
