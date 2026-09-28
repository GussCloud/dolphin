# Fork identity (Dolphin)

This fork ships as **Dolphin** so it can be installed beside the official Orca without sharing anything. The identity is defined in `src/shared/fork-identity.ts`. The CommonJS electron-builder config reads a mirror of it, `src/shared/fork-identity.json`, and `src/main/startup/fork-identity.test.ts` keeps the two equal.

| Surface                    | Official Orca                     | Dolphin                              | Where                                                                                                                |
| -------------------------- | --------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| App id / Windows AUMID     | `com.stablyai.orca`               | `com.gusscloud.dolphin`              | builder `appId`, `dev-instance-identity.ts`, local-build contract                                                    |
| Product name / install dir | `Orca`                            | `Dolphin`                            | builder `productName`                                                                                                |
| Executable                 | `Orca.exe`                        | `Dolphin.exe`                        | builder `win.executableName`, CLI launcher looks for either                                                          |
| userData                   | `%APPDATA%\orca`                  | `%APPDATA%\dolphin`                  | `configure-process.ts`, CLI `metadata.ts`, `codex-home-paths.ts`, builder `extraMetadata.name`                       |
| Relocated daemon host      | `%LOCALAPPDATA%\Orca\daemon-host` | `%LOCALAPPDATA%\Dolphin\daemon-host` | `daemon-host-relocation.ts`, NSIS `${PRODUCT_NAME}`                                                                  |
| Markdown ProgID            | `Orca.Markdown`                   | `Dolphin.Markdown`                   | NSIS `${PRODUCT_NAME}`                                                                                               |
| Update feed                | `stablyai/orca`                   | `GussCloud/dolphin`                  | `release-channel.ts`, `updater-setup.ts`, `updater-release-feed.ts`, `updater-prerelease-feed.ts`, builder `publish` |
| Installer                  | `orca-windows-setup.exe`          | `dolphin-windows-setup.exe`          | builder `nsis.artifactName`                                                                                          |

## CLI

The command is `dolphin` on macOS and Windows and `dolphin-ide` on Linux and WSL, where KDE Dolphin owns `/usr/bin/dolphin` (the same reason upstream used `orca-ide`). The names live in `fork-identity.ts` (`cliCommandName`, `linuxCliCommandName`) and reach code through `src/shared/cli-command-names.ts`. Dolphin no longer ships or registers `orca`.

- **Windows:** `resources\bin` ships `dolphin.cmd` and the native `dolphin.exe`. Its image name matches `Dolphin.exe` case-insensitively, which only matters to the installer's fallback process check; that check already treats any process under the install dir as the running app, so a running CLI blocked updates before the rename too.
- **Inside Dolphin's own terminals:** a bare `dolphin` shim is put first on PATH, including on Linux, and `ORCA_CLI_COMMAND` names the command for agents.
- **Remote hosts:** SSH hosts get a `dolphin` relay shim in `~/.orca-relay/bin`. An upstream `orca` shim there is left alone.
- **Wire compatibility:** `compatibilityCliCommand` still carries the legacy `orca`/`orca-ide`/`orca-dev` token. Hosts that predate the rename validate it as a closed enum. Current hosts accept both spellings and map them to the installed name before showing a command.
- **Dev builds:** they keep `orca-dev`, which contributor tooling (the `package.json` bin and the dev profile directory) owns.

## Signing

Dolphin's Windows installers are unsigned: there is no SignPath certificate. Unless `ORCA_WIN_SIGNPATH_SIGNED=1` is set, the builder omits `publisherName` and sets `verifyUpdateCodeSignature: false`. Without that, every update would fail Authenticode verification. Windows SmartScreen warns on first run.

## Upstream endpoints

Every link and service the app reaches is defined in `src/shared/fork-identity.ts`. Nothing reaches `stablyai/orca` or `*.onorca.dev` any more, except the mobile app download links (the official Orca mobile app is the only one, and it pairs with Dolphin).

| What                                            | Now                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Skills installed into agents (`npx skills add`) | `GussCloud/dolphin`                                                            |
| GitHub links, issues, star prompt, share card   | `GussCloud/dolphin`                                                            |
| Docs, telemetry notice                          | `https://dolphin.guss.dev.br/docs`                                             |
| Changelog page                                  | GitHub releases of this repo                                                   |
| Update changelog/nudge feeds, plugin kill-list  | `https://dolphin.guss.dev.br/{whats-new,plugins}/...` (fail soft while absent) |
| Cloud sign-in (`dolphin-desktop` client)        | `https://auth.dolphin.guss.dev.br`                                             |
| Mobile relay director                           | `https://relay.dolphin.guss.dev.br`                                            |
| Push gateway                                    | `https://push.dolphin.guss.dev.br`                                             |
| Artifact and skill sharing (host allowlist too) | `https://share.dolphin.guss.dev.br`                                            |
| Feedback and crash reports                      | `https://api.dolphin.guss.dev.br/v1/feedback`                                  |

## Home state

Credentials move to `~/.dolphin` (Jira, Linear, Bitbucket, MiniMax, OpenAI speech key), so Dolphin never reads or overwrites the official Orca's.

`~/.orca/agent-hooks` stays shared on purpose. Agent configs such as `~/.claude/settings.json` point at that single script, and the script forwards each event to the app whose terminal launched the agent (`ORCA_AGENT_HOOK_PORT`). A second, Dolphin-only path would register every hook twice and let each app prune the other's entries. `~/.orca-remote` on SSH hosts and the `orcad` state root stay too, for the same reason.

## Not yet separated

- `TERM_PROGRAM=Orca`, which CLIs use to detect the terminal.
- The mobile app itself (`mobile/`), which still builds as `com.stably.orca.mobile`.
