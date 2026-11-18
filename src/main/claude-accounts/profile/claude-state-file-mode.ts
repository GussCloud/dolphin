// Why its own module: the DeepSeek onboarding seed must stay free of the profile JSON writer's
// lockfile graph, yet every writer of a Claude state file must agree on its permission bits.
/** `.claude.json` carries the account and per-project state: owner-only, as Claude itself writes it. */
export const CLAUDE_STATE_FILE_MODE = 0o600
