# Release Process

Pull requests never change a version: not `package.json`, not `mobile/app.json`'s `expo.version` or `android.versionCode`. Versions exist only in release builds.

Branches: every pull request targets `develop`. `main` is what is officially published, and only the promote workflow moves it. Two workflows produce versions, and both build a commit that is already on `develop`:

| Workflow                                                       | Runs                                | Produces                                          | Gate                                                                |
| -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| [Release Beta](../../.github/workflows/release-beta.yml)       | Every push to `develop`, or by hand | Desktop `vX.Y.Z-rc.N`, mobile `X.Y.Z` beta builds | The commit is on `develop`                                          |
| [Release Promote](../../.github/workflows/release-promote.yml) | By hand                             | Desktop `vX.Y.Z`, mobile `X.Y.Z` official builds  | Commit on `develop`, its PR's `verify` passed, full e2e suite green |

Both call the per-platform workflows (`dolphin-windows-release.yml`, which also builds macOS; `dolphin-android-release.yml`; `dolphin-ios-release.yml`) through `workflow_call`. Those no longer run on a push or a tag; the desktop one cannot be dispatched by hand at all, and a manual Android or iOS dispatch never publishes a GitHub release.

## Cutting a beta

**Automatically:** merging a pull request into `develop` runs Release Beta on that exact commit with `bump: patch`. `config/scripts/beta-release-scope.mjs` decides which apps get a beta, each against its own nearest release tag reachable from the commit (rc or stable):

- **Desktop** (nearest `v*`): any changed path outside `mobile/` that is not docs-only (`isDocsOnlyPath` in `pr-code-change-scope.mjs`) and not a test (`*.test.*`, `tests/`, `__tests__/`, `__fixtures__/`). Workflow and build-script changes count.
- **Mobile** (nearest `mobile-android-v*`, never `mobile-android-latest`): any changed path under `mobile/` that is not a test or a `.md` file.
- An app with no tag yet counts as changed. If neither changed, the run succeeds and its summary says no beta was needed.

Merges that arrive while a beta is building wait in the `release-beta` group. GitHub keeps only the newest waiting run, which is safe: its commit contains the skipped merges, and scope and rc are counted from the last tag. Promote runs have their own `release-promote` group, so a merge never replaces a waiting promote.

**By hand:** Actions → **Release Beta** → Run workflow:

- `app`: `desktop`, `mobile` or `both` (no scope detection).
- `ref`: a SHA or ref on `develop`; empty means the tip of `develop`.
- `bump`: `patch` (default), `minor` or `major`, counted from the last stable release.

`config/scripts/next-release-version.mjs` computes the version:

- **Desktop:** the last stable tag (`latest-stable-release.mjs`), bumped, then the next rc of that base. Existing rc numbers come from every release including drafts, plus git history (`release-rc-history.mjs`). So `v0.2.55` gives `v0.2.56-rc.1`, then `-rc.2`. If a higher rc line is still unpromoted (say `0.3.0-rc.1` after a `minor` cut), a later `patch` beta continues that line. Otherwise RC users, who only move to newer semver, would never receive it.
- **Mobile:** the same rule on `mobile-android-v*` tags, with `mobile/app.json`'s version counting as a stable release.

What gets published:

- **Desktop:** a GitHub **prerelease** `vX.Y.Z-rc.N` in this repository, with `latest.yml`, `latest-arm64.yml`, `latest-mac.yml`, the Windows x64/arm64 installers, the macOS dmgs and zips, and their blockmaps. The in-app updater treats any version with a `-` as the RC channel (`src/shared/release-channel.ts`). Users who opted into prereleases, or who already run an rc, find it through the releases atom feed (`src/main/updater-prerelease-feed.ts`). Stable users never see it, and it is never marked latest.
- **Android:** a GitHub prerelease `mobile-android-vX.Y.Z-rc.N` carrying `dolphin-android.apk`. `mobile-android-latest`, the desktop's "Download APK" link, stays on the last stable release.
- **iOS:** a TestFlight build of `X.Y.Z` with the next build number. Only the internal group `dolphin-internal` gets it. iOS marketing versions cannot carry `-rc`, so every rc of a line is another build number of the same `X.Y.Z`.

## Promoting to an official release

Actions → **Release Promote** → Run workflow:

- `app`: `desktop`, `mobile` or `both`.
- `desktop_rc_tag` / `mobile_rc_tag`: the rc to promote. `latest` (the default) picks the newest published rc.

The `resolve` job checks four things before anything is built:

- the rc is a published release;
- `X.Y.Z` does not exist yet and is newer than the last stable release;
- the rc tag's commit is on `develop`;
- the pull request that landed that commit has a successful `verify` check, which is `pr.yml`'s aggregate (`verify-release-commit.mjs`).

Alongside the approval, the `e2e` and `e2e_wsl` jobs run the **whole** e2e suite (`e2e.yml` with no spec list: 14 shards plus the Docker-SSH lanes, and the real-WSL lane) on that commit. No build starts, and `main` does not move, unless both pass. This adds about 30 minutes to a promote. Pull requests run only the e2e they wrote or edited, and [E2E develop](../../.github/workflows/e2e-develop.yml) runs the same full suite on `develop` at 03:13 and 13:13 (Brasília) when `develop` changed, opening or updating one issue that names the PRs merged since the last green run, so a red suite is usually known before a promote.

The owner's approval is the dispatch itself: only someone who can run workflows starts a promote (agents cannot). If the `production` environment has required reviewers, the run also waits there for one. It then rebuilds **the commit the rc tag points at**, versioned `X.Y.Z`:

- **Desktop:** published as the latest stable release `vX.Y.Z`.
- **Android:** `mobile-android-vX.Y.Z`, and `mobile-android-latest` is refreshed.
- **iOS:** the fastlane `release` lane uploads a new build of `X.Y.Z` and distributes it to the external TestFlight group `peeps`.

Last, the `fast-forward-main` job moves `main` to the promoted commit (with both apps, the newer of the two rc commits), never by force: a fast-forward when `main` is behind it, otherwise a merge commit on `main` (after a sync PR left one there). If `main` already contains it, nothing moves.

`GITHUB_TOKEN` can never hold the `workflows` permission, so GitHub refuses the push whenever the range edits `.github/workflows/`. The job then ends with a warning, not a failure, because the release is already published, and its summary names the commit. To finish, point a branch at that commit, open a PR from it into `main` and merge it with the Claude GitHub App, which has that permission (the agent does this; nobody touches repository settings). Any other rejection fails the job with an error. Nothing is undone.

## How versions reach the build without a commit

- **Desktop:** every packaging job runs `config/scripts/stamp-release-version.mjs desktop <version>`, which rewrites `package.json` in the runner's checkout before building.
- **Android:** the same script stamps `expo.version` and `android.versionCode`, and `mobile/scripts/prepare-android-release.mjs` then reads them as usual. The versionCode is derived from the version: `major·10⁷ + minor·10⁵ + patch·100 + rc`, where a stable release uses 99. It rises with semver, and every stable outranks its own rcs.
- **iOS:** the existing `prepare_release_version` lane writes the marketing version and the next TestFlight build number.

The desktop release is assembled as a **draft**:

1. `build-win` runs `create-draft-release.mjs` and uploads the Windows x64 files.
2. The arm64 and macOS jobs upload into the same draft.
3. The `publish` job runs `verify-release-required-assets.mjs --platforms=mac,win,win-arm64`, then undrafts the release.

The updater never sees a release that is missing a platform's manifest. If a leg fails, nothing is published: re-run the failed jobs. A later run for the same version deletes the stale draft before it starts.

## Repository settings

The flow works with the repository as it is: nothing below has to be changed. Each item is an optional hardening:

1. **`develop` as the default branch.** With `main` as the default, pull requests are still aimed at `develop` explicitly, and Dependabot targets it in its config; scheduled workflows run the copies on `main`, which promote keeps current.
2. **Required reviewers on `production`.** GitHub creates the environment on first use with no reviewers, so promote then runs as soon as it is dispatched. Adding yourself as a required reviewer adds a second confirmation.
3. **Let promote move `main`.** `main` has no protection today, so the workflow's push goes through. If you add a ruleset or branch protection that requires pull requests or status checks, put `github-actions` (the `GITHUB_TOKEN`) on its bypass list, and keep force pushes and deletions blocked. Ranges that edit `.github/workflows/` always need the sync PR described above. Protect `develop` with the `verify` check instead.
4. **Secrets the platform workflows already use**, which must stay set as repository secrets (`secrets: inherit` passes them through):
   - macOS: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.
   - iOS: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8`, `APPLE_TEAM_ID`, `IOS_DIST_CERT_P12`, `IOS_DIST_CERT_PASSWORD`.
   - Android (optional but needed for in-place updates): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

   If any of these are environment secrets rather than repository secrets, move them to repository secrets: the called jobs do not run in an environment.

5. **Actions permissions.** Settings → Actions → General → Workflow permissions must allow `GITHUB_TOKEN` to create releases. The jobs request `contents: write`, so a read-only org policy blocks them.

## Still manual

- App Store review submission after promote. External TestFlight distribution may also wait on Apple's Beta App Review.
- Release notes beyond GitHub's generated notes: commit `docs/releases/vX.Y.Z.md` before cutting, and the desktop workflow uses it.
- Deleting abandoned rc releases or drafts.
- Local Android builds keep the committed `versionCode` (32), which is below every released APK's versionCode, so a phone running a release has to uninstall it before installing a local build.
