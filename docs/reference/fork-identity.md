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
| macOS disk images          | `dolphin-macos-{x64,arm64}.dmg`      | builder `dmg.artifactName`                                                                                           |

## CLI

The command is `dolphin` on macOS and Windows and `dolphin-ide` on Linux and WSL, where the KDE Dolphin file manager owns `/usr/bin/dolphin`. Dev builds use `dolphin-dev`. The names live in `fork-identity.ts` (`cliCommandName`, `linuxCliCommandName`, `devCliCommandName`) and reach code through `src/shared/cli-command-names.ts`.

- **Windows:** `resources\bin` ships `dolphin.cmd` and the native `dolphin.exe`. Its image name matches `Dolphin.exe` case-insensitively, which only matters to the installer's fallback process check; that check already treats any process under the install dir as the running app.
- **Inside Dolphin's own terminals:** a bare `dolphin` shim is put first on PATH, including on Linux, and `DOLPHIN_CLI_COMMAND` names the command for agents.
- **Remote hosts:** SSH hosts get a `dolphin` relay shim in `~/.dolphin-relay/bin`.
- **Wire:** `compatibilityCliCommand` carries the installed command name. Hosts from v0.1.x accepted only the upstream names, so pair a client only with a host of the same generation.

## Signing

Dolphin's Windows installers are unsigned: there is no SignPath certificate. Unless `DOLPHIN_WIN_SIGNPATH_SIGNED=1` is set, the builder omits `publisherName` and sets `verifyUpdateCodeSignature: false`. Without that, every update would fail Authenticode verification. Windows SmartScreen warns on first run.

The macOS builds are signed with the team's Developer ID Application certificate (team `Z2KZSCJ22L`) and notarized, so they open without a Gatekeeper warning and update themselves: Squirrel.Mac installs an update only when its signature satisfies the running app's designated requirement, which every build signed by the same team does. The `build-mac` job in `dolphin-windows-release.yml` sets `DOLPHIN_MAC_RELEASE=1` and reads these repository secrets:

| Secret                                 | Content                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`                             | the Developer ID Application `.p12` (certificate, private key and the Developer ID G2 intermediate), base64 |
| `CSC_KEY_PASSWORD`                     | the `.p12` password                                                                                         |
| `APPLE_API_KEY`                        | the App Store Connect API key (`.p8` contents); the job writes it to a file for notarytool                  |
| `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` | that key's ID and issuer                                                                                    |

`config/scripts/verify-macos-release-env.mjs` fails the job before packaging if any of these is missing, because electron-builder skips notarization with only a warning. After packaging, the job requires a Developer ID authority, a stapled ticket and a passing `spctl` assessment on both slices. The certificate expires in December 2027; renew it before then and replace `CSC_LINK` and `CSC_KEY_PASSWORD`.

Releases up to 0.2.45 were ad-hoc signed with `DOLPHIN_MAC_UNSIGNED_RELEASE=1`, which writes a `dolphin-unsigned-mac-release` marker into `Contents/Resources`. The marker makes those installs announce a release and point the user at the new `.dmg` instead of downloading it (`src/main/mac-unsigned-release.ts`), because no ad-hoc signature ever matches the next build. Those users install one signed `.dmg` by hand; from then on updates are automatic. The flag still exists as a fallback for a build without the Developer ID secrets.

Dolphin Mobile for iOS ships through TestFlight as the App Store Connect app "Dolphin for Agents" (bundle `com.gusscloud.dolphin.mobile`, app id `6835496344`). `dolphin-ios-release.yml` runs `mobile/fastlane` when `release-beta.yml` or `release-promote.yml` calls it (see `release-process.md`) and uploads the build; the internal group `dolphin-internal` has access to every build, so testers get it once Apple finishes processing, with no beta review. It reads these repository secrets:

| Secret                                          | Content                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `IOS_DIST_CERT_P12`, `IOS_DIST_CERT_PASSWORD`   | the Apple Distribution `.p12` (with the WWDR G3 intermediate), base64, and its password      |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8` | the App Store Connect API key (`.p8` base64); fastlane fetches the App Store profile with it |
| `APPLE_TEAM_ID`                                 | `Z2KZSCJ22L`                                                                                 |

The distribution certificate expires in November 2027. iOS push needs an APNs key configured on the push gateway, which is not done yet.

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
