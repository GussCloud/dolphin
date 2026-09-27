# Fork identity (Dolphin)

This fork ships as **Dolphin** so it can be installed beside the official Orca without sharing anything. The identity is defined in `src/shared/fork-identity.ts`. The CommonJS electron-builder config reads a mirror of it, `src/shared/fork-identity.json`, and `src/main/startup/fork-identity.test.ts` keeps the two equal.

| Surface | Official Orca | Dolphin | Where |
|---|---|---|---|
| App id / Windows AUMID | `com.stablyai.orca` | `com.gusscloud.dolphin` | builder `appId`, `dev-instance-identity.ts`, local-build contract |
| Product name / install dir | `Orca` | `Dolphin` | builder `productName` |
| Executable | `Orca.exe` | `Dolphin.exe` | builder `win.executableName`, CLI launcher looks for either |
| userData | `%APPDATA%\orca` | `%APPDATA%\dolphin` | `configure-process.ts`, CLI `metadata.ts`, `codex-home-paths.ts`, builder `extraMetadata.name` |
| Relocated daemon host | `%LOCALAPPDATA%\Orca\daemon-host` | `%LOCALAPPDATA%\Dolphin\daemon-host` | `daemon-host-relocation.ts`, NSIS `${PRODUCT_NAME}` |
| Markdown ProgID | `Orca.Markdown` | `Dolphin.Markdown` | NSIS `${PRODUCT_NAME}` |
| Update feed | `stablyai/orca` | `GussCloud/orca` | `release-channel.ts`, `updater-setup.ts`, `updater-release-feed.ts`, `updater-prerelease-feed.ts`, builder `publish` |
| Installer | `orca-windows-setup.exe` | `dolphin-windows-setup.exe` | builder `nsis.artifactName` |

## CLI

The packaged `resources\bin` still ships `orca.exe` and `orca.cmd`. Agents, skills, and orchestration inside Dolphin's own terminals call `orca`, and those terminals put Dolphin's `bin` first on PATH, so `orca` there reaches Dolphin. For shells outside the app, `bin\dolphin.cmd` is an unambiguous alias, because the official Orca may own `orca` on PATH.

## Signing

Dolphin's Windows installers are unsigned: there is no SignPath certificate. Unless `ORCA_WIN_SIGNPATH_SIGNED=1` is set, the builder omits `publisherName` and sets `verifyUpdateCodeSignature: false`. Without that, every update would fail Authenticode verification. Windows SmartScreen warns on first run.

## Not yet separated

These still point at upstream or are shared with it:

- `~/.orca` home state, which dev and prod already share: hooks, Jira credentials, agent-teams shim.
- The WSL bridge path.
- The upstream changelog and nudge feeds on onorca.dev.
- In-app "Orca" branding strings.

None of these affect installing Dolphin beside Orca.
