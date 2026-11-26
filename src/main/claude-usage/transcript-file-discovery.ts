import { homedir } from 'node:os'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME } from '../../shared/deepseek-claude-provider'

/**
 * Who wrote a Claude-format transcript corpus. DeepSeek and API-key accounts run the Claude Code
 * CLI under their own config dirs, so their transcripts share the parser but must never land in
 * the subscription's report.
 */
export type ClaudeTranscriptUsageSource = 'claude' | 'deepseek' | 'claude-api'

// Why null for claude-api: its corpus is only the API account profiles the caller passes.
const CONFIG_DIR_NAME_BY_SOURCE: Record<ClaudeTranscriptUsageSource, string | null> = {
  claude: '.claude',
  deepseek: DEEPSEEK_CLAUDE_CONFIG_DIR_NAME,
  'claude-api': null
}

async function walkJsonlFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      appendDiscoveredFiles(files, await walkJsonlFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath)
    }
  }

  return files
}

function appendDiscoveredFiles(target: string[], source: readonly string[]): void {
  // Why: long-lived transcript directories can exceed V8's argument limit if
  // child file arrays are spread into push().
  for (const filePath of source) {
    target.push(filePath)
  }
}

export function getClaudeTranscriptRoots(
  source: ClaudeTranscriptUsageSource,
  home: string = homedir()
): string[] {
  const configDirName = CONFIG_DIR_NAME_BY_SOURCE[source]
  if (!configDirName) {
    return []
  }
  const configDir = join(home, configDirName)
  return [join(configDir, 'projects'), join(configDir, 'transcripts')]
}

// Why local home only: Claude usage never scanned WSL homes, and DeepSeek is refused over SSH.
export async function listClaudeTranscriptFiles(
  source: ClaudeTranscriptUsageSource = 'claude',
  profileConfigDirs: readonly string[] = []
): Promise<string[]> {
  // Why: managed Claude accounts write into their isolated profiles, never DeepSeek's corpus. The
  // caller decides which profiles: plan profiles for `claude`, API account profiles for `claude-api`.
  const profileRoots =
    source === 'deepseek'
      ? []
      : profileConfigDirs.flatMap((dir) => [join(dir, 'projects'), join(dir, 'transcripts')])
  const files = await Promise.all(
    [...getClaudeTranscriptRoots(source), ...profileRoots].map(async (root) => {
      try {
        return await walkJsonlFiles(root)
      } catch {
        return []
      }
    })
  )
  return [...new Set(files.flat())].sort()
}
