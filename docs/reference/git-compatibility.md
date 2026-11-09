# Git Compatibility Policy

## Scope

Dolphin executes the user's Git binary on three kinds of execution host: native,
WSL, and SSH. Each host can have a different Git version, so compatibility
state must be scoped to the host that actually runs the command.

Git 2.25 is the core-workflow compatibility baseline for command selection. It
is the oldest line that covers Dolphin's baseline use of porcelain v2, `branch
--show-current`, `restore`, and sparse checkout. Optional features that need a
newer Git must degrade safely and cache the missing capability. Dolphin does not
currently block older Git at startup, but new command construction should not
assume features introduced after this baseline.

## Capability Rules

When a newer Git feature materially improves correctness or performance:

1. Keep a baseline-compatible command or parser as the fallback.
2. Detect rejection with a narrow predicate for that option or subcommand.
3. Run the preferred command through `GitCapabilityCache` so a rejection is
   remembered for the native host, WSL distro, or SSH provider that produced it.
4. Retry after the cache interval so an in-place Git upgrade self-heals without
   restarting Dolphin.
5. Test the first fallback, later calls that skip the rejected probe, concurrent
   probe coalescing, and execution-host isolation where applicable.

Do not branch only on a parsed `git --version`. Vendor builds can backport
features, and wrappers can report a host version that differs from the binary
used inside WSL or SSH. A behavior probe plus a precise fallback is the final
authority.

## Current Capabilities

| Capability                  | Preferred behavior                                                      | Compatibility behavior                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch-no-write-fetch-head` | Fetch a private rebase ref without changing worktree-local `FETCH_HEAD` | Serialize all Dolphin fetch/pull operations per worktree Git directory before Git 2.29                                                                                                                     |
| `worktree-list-z`           | NUL-delimited worktree paths with `prunable` marks                      | Line-block parser for Git before `worktree list -z` (2.36); the `prunable`/`locked` annotations still parse on Git 2.31–2.35, and a path-existence probe restores `prunable` detection for Git before 2.31 |
| `rev-parse-path-format`     | Absolute repo metadata paths                                            | Resolve legacy relative output against the scanned repo                                                                                                                                                    |
| `for-each-ref-exclude`      | Exclude remote HEAD before the output limit                             | Request extra refs, then filter remote HEAD in Dolphin                                                                                                                                                     |
| `merge-tree-write-tree`     | Derive real-merge conflicts and no-op tree proofs                       | Omit the conflict summary and keep conservative branch cleanup behavior before Git 2.38                                                                                                                    |
| `merge-tree-merge-base`     | Supply the already-resolved merge base                                  | Use the older two-commit `merge-tree --write-tree` form                                                                                                                                                    |

### Placeholders That Fail Open

`GitCapabilityCache` records commands Git _rejects_. A `git log --format`
placeholder Git does not know is not rejected: Git echoes it verbatim and exits
zero, so there is no error to remember and no probe to cache. Ask for both forms
in one record and pick at parse time.

| Placeholder     | Preferred behavior                                                                        | Compatibility behavior                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `%(decorate:…)` | Git 2.43 separates commit decorations with `\x1f`, so ref names containing commas survive | The same record also carries `%D` (Git 2.10); an unexpanded `%(decorate` placeholder selects it, at the cost of comma-splitting |

### Config That Fails Open

Some config is accepted by every Git but means nothing on an older one, so there is no error
to cache either. The fix is to emit only the form the baseline understands.

| Config                    | Baseline behavior                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `credential.<url>.helper` | Per-project accounts (`src/shared/git-scoped-credential-helper.ts`) scope the helper to concrete `https://<host>` URLs. Host wildcards such as `https://*.visualstudio.com` match only from Git 2.26; on 2.25 they match nothing and git silently uses the global login. |
| `quit=1` from a helper    | Honored on 2.25.5. The fail-closed outcome does not depend on it: the empty `helper=` reset leaves no other helper, so git stops at "could not read Username" without the global login.                                                                                  |

Git 2.25 also compares the credential host case-sensitively, so a remote written
`https://MyOrg.visualstudio.com/...` misses a `https://myorg.visualstudio.com` key. Keys are
emitted in each spelling a reachable URL uses, and the reachable URLs include every
`url.<base>.insteadOf`/`pushInsteadOf` base, so a rewritten remote is scoped too.

Terminals receive the same config through the environment. `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n`
needs Git 2.31 and is silently ignored by 2.25, so project accounts use `GIT_CONFIG_PARAMETERS`
in the classic `'key=value'` form, which every supported Git parses. Inherited `GIT_CONFIG_COUNT`
entries are applied before it, so the project's entries stay last
(`src/shared/git-config-parameters.ts`).

The real-binary contract below exercises the reset, the scoped helper, a concrete
`visualstudio.com` host, an `insteadOf` rewrite to a mixed-case host, and the fail-closed
path on every lane.

## Why Not `simple-git`

`simple-git` is a process wrapper around the installed Git binary. Its custom
options and `raw` API pass arguments through to Git, so it cannot make a newer
flag work on an older binary or choose Dolphin's semantic fallback automatically.
It provides version reporting and subprocess queueing, but Dolphin already needs
its own WSL/SSH routing, cancellation, tracing, redaction, process cleanup, and
bounded output handling. Replacing the runner would move—not remove—the
capability problem.

## CI Contract

PR checks run the capability contract against real Git 2.25.5, 2.38.1, and
2.49.1 binaries. This spans the pre-2.29 serialized `FETCH_HEAD` fallback, the transitional
`merge-tree --write-tree` behavior before `--merge-base`, and current Git.

The three lanes run in parallel and each Git call in the container lanes costs a
container start, so their wall clock is runner contention, not Git. Build the
2.25.5 binary and pull the images before the lanes start: anything heavy left
running alongside them is charged to whichever boundary case is in flight and
surfaces as a Vitest timeout rather than as a slow setup step.

Keep the unit tests alongside that matrix. They cover concurrent probes,
native/WSL/SSH/relay isolation, and error-stream shapes that a single real
binary invocation cannot exercise deterministically.
