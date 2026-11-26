import { app } from 'electron'
import { join } from 'node:path'
import type { Store } from '../persistence'
import { scanClaudeApiUsageFilesViaWorker } from '../usage/usage-scan-worker-spawn'
import { ClaudeTranscriptUsageStore } from '../claude-usage/claude-transcript-usage-store'

// Why: captured before app.setName() moves userData, like the Claude usage cache path.
let _claudeApiUsageFile: string | null = null

export function initClaudeApiUsagePath(): void {
  _claudeApiUsageFile = join(app.getPath('userData'), 'dolphin-claude-api-usage.json')
}

function getClaudeApiUsageFile(): string {
  if (!_claudeApiUsageFile) {
    _claudeApiUsageFile = join(app.getPath('userData'), 'dolphin-claude-api-usage.json')
  }
  return _claudeApiUsageFile
}

/**
 * Usage of the API-key accounts: Claude's parser over their profiles only, under its own cache.
 * Priced with Claude's list-price table (no `estimateCost` override), since these turns are API
 * billing; the estimate ignores discounts, batch pricing and anything else on the invoice.
 */
export class ClaudeApiUsageStore extends ClaudeTranscriptUsageStore {
  constructor(store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>) {
    super(store, {
      logTag: '[claude-api-usage]',
      resolveCacheFile: getClaudeApiUsageFile,
      scan: scanClaudeApiUsageFilesViaWorker
    })
  }
}
