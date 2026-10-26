import { app } from 'electron'
import { join } from 'node:path'
import type { AutomationRunUsage } from '../../shared/automations-types'
import type { Store } from '../persistence'
import { scanClaudeUsageFilesViaWorker } from '../usage/usage-scan-worker-spawn'
import { ClaudeTranscriptUsageStore } from './claude-transcript-usage-store'
import type { AutomationUsageLookupInput } from './claude-usage-automation-attribution'
import { resolveAutomationRunUsage } from './claude-usage-automation-attribution'

// Why: capture the path after configureDevUserDataPath() but before app.setName()
// mutates Electron's derived userData location, matching the persistence/store pattern.
let _claudeUsageFile: string | null = null

export function initClaudeUsagePath(): void {
  _claudeUsageFile = join(app.getPath('userData'), 'dolphin-claude-usage.json')
}

function getClaudeUsageFile(): string {
  if (!_claudeUsageFile) {
    _claudeUsageFile = join(app.getPath('userData'), 'dolphin-claude-usage.json')
  }
  return _claudeUsageFile
}

export class ClaudeUsageStore extends ClaudeTranscriptUsageStore {
  constructor(store: Pick<Store, 'getRepos' | 'getAllWorktreeMeta'>) {
    super(store, {
      logTag: '[claude-usage]',
      resolveCacheFile: getClaudeUsageFile,
      scan: scanClaudeUsageFilesViaWorker
    })
  }

  async getAutomationRunUsage(input: AutomationUsageLookupInput): Promise<AutomationRunUsage> {
    await this.ensureLoaded()
    return resolveAutomationRunUsage(input, {
      getState: () => this.state,
      refresh: (force) => this.refresh(force),
      isScanning: () => this.currentScanState().isScanning
    })
  }
}
