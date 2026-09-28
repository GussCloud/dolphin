# Product identity (Dolphin)

The identity is defined in `src/shared/fork-identity.ts`. The CommonJS electron-builder config reads a mirror of it, `src/shared/fork-identity.json`, and `src/main/startup/fork-identity.test.ts` keeps the two equal.

| Surface                    | Value                                | Where                                                                                                                |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| App id / Windows AUMID     | `com.gusscloud.dolphin`              | builder `appId`, `dev-instance-identity.ts`, local-build contract                                                    |
| Product name / install dir | `Dolphin`                            | builder `productName`                                                                                                |
| Executable                 | `Dolphin.exe`                        | builder `win.executableName`                                                                                         |
| userData                   | `%APPDATA%\dolphin`                  | `configure-process.ts`, CLI `metadata.ts`, `codex-home-paths.ts`, builder `extraMetadata.name`                       |
| Relocated daemon host      | `%LOCALAPPDATA%\Dolphin\daemon-host` | `daemon-host-relocation.ts`, NSIS `${PRODUCT_NAME}`                                                                  |
| Markdown ProgID            | `Dolphin.Markdown`                   | NSIS `${PRODUCT_NAME}`                                                                                               |
| Update feed                | `GussCloud/dolphin`                  | `release-channel.ts`, `updater-setup.ts`, `updater-release-feed.ts`, `updater-prerelease-feed.ts`, builder `publish` |
| Installer                  | `dolphin-windows-setup.exe`          | builder `nsis.artifactName`                                                                                          |

## CLI

The command is `dolphin` on macOS and Windows and `dolphin-ide` on Linux and WSL, where the KDE Dolphin file manager owns `/usr/bin/dolphin`. Dev builds use `dolphin-dev`. The names live in `fork-identity.ts` (`cliCommandName`, `linuxCliCommandName`, `devCliCommandName`) and reach code through `src/shared/cli-command-names.ts`.

- **Windows:** `resources\bin` ships `dolphin.cmd` and the native `dolphin.exe`. Its image name matches `Dolphin.exe` case-insensitively, which only matters to the installer's fallback process check; that check already treats any process under the install dir as the running app.
- **Inside Dolphin's own terminals:** a bare `dolphin` shim is put first on PATH, including on Linux, and `DOLPHIN_CLI_COMMAND` names the command for agents.
- **Remote hosts:** SSH hosts get a `dolphin` relay shim in `~/.dolphin-relay/bin`.
- **Wire:** `compatibilityCliCommand` carries the installed command name. Hosts from v0.1.x accepted only the upstream names, so pair a client only with a host of the same generation.

## Signing

Dolphin's Windows installers are unsigned: there is no SignPath certificate. Unless `DOLPHIN_WIN_SIGNPATH_SIGNED=1` is set, the builder omits `publisherName` and sets `verifyUpdateCodeSignature: false`. Without that, every update would fail Authenticode verification. Windows SmartScreen warns on first run.

## Endpoints

Every link and service the app reaches is defined in `src/shared/fork-identity.ts`.

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

Credentials live in `~/.dolphin` (Jira, Linear, Bitbucket, MiniMax, OpenAI speech key). `~/.dolphin/agent-hooks` holds the single hook script agent configs such as `~/.claude/settings.json` point at; it forwards each event to the app whose terminal launched the agent (`DOLPHIN_AGENT_HOOK_PORT`). SSH hosts keep state under `~/.dolphin-remote`.

## Upgrading from v0.1.x

v0.1.x stored its state files, home dir, environment variables, and keychain entries under the upstream product's names. This release does not migrate them: sign in again and reconfigure integrations after updating.
