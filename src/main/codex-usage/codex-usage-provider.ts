import type { UsageProvider } from '../usage/usage-provider-contract'
import { scanCodexUsageFilesViaWorker } from '../usage/usage-scan-worker-spawn'
import type { CodexUsageDailyAggregate, CodexUsagePersistedFile, CodexUsageSession } from './types'

// Why: v5 keys Codex ownership on raw token_count identity without session id
// so forks that rewrite session_meta still match. Older caches used session-
// scoped keys and can double-count after fork/resume (#8006).
// v6 adds per-request long-context token counts, which older rows cannot be backfilled with.
// v7 stores ownership keys as compact digests; v6 caches are migrated in place by the scan
// worker, and older builds reset on v7 rather than mismatching digests and raw keys.
export const CODEX_USAGE_SCHEMA_VERSION = 7
export const CODEX_USAGE_RAW_OWNERSHIP_KEY_SCHEMA_VERSION = 6

export const codexUsageProvider = {
  id: 'codex',
  label: 'Codex',
  schemaVersion: CODEX_USAGE_SCHEMA_VERSION,
  scan: scanCodexUsageFilesViaWorker
} satisfies UsageProvider<
  'processedFiles',
  CodexUsagePersistedFile,
  CodexUsageSession,
  CodexUsageDailyAggregate
>
