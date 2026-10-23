import { app } from 'electron'
import { join } from 'node:path'
import type { Store } from '../persistence'
import { scanDeepSeekUsageFilesViaWorker } from '../usage/usage-scan-worker-spawn'
import { ClaudeTranscriptUsageStore } from '../claude-usage/claude-transcript-usage-store'

// Why: captured before app.setName() moves userData, like the Claude usage cache path.
let _deepSeekUsageFile: string | null = null

export function initDeepSeekUsagePath(): void {
  _deepSeekUsageFile = join(app.getPath('userData'), 'dolphin-deepseek-usage.json')
}

function getDeepSeekUsageFile(): string {
  if (!_deepSeekUsageFile) {
    _deepSeekUsageFile = join(app.getPath('userData'), 'dolphin-deepseek-usage.json')
  }
  return _deepSeekUsageFile
}

/** No DeepSeek pricing table exists; Claude rates would misprice every turn. */
export function estimateDeepSeekCostUsd(): null {
  return null
}

/** DeepSeek runs Claude Code, so its transcripts reuse Claude's parser under a separate cache. */
export class DeepSeekUsageStore extends ClaudeTranscriptUsageStore {
  constructor(store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>) {
    super(store, {
      logTag: '[deepseek-usage]',
      resolveCacheFile: getDeepSeekUsageFile,
      scan: scanDeepSeekUsageFilesViaWorker,
      estimateCost: estimateDeepSeekCostUsd
    })
  }
}
