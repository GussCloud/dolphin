import { homedir } from 'node:os'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME } from '../../shared/deepseek-claude-provider'

/**
 * Who wrote a Claude-format transcript corpus. DeepSeek runs the Claude Code CLI under its own
 * config dir, so its transcripts share the parser but must never land in Claude's report.
 */
export type ClaudeTranscriptUsageSource = 'claude' | 'deepseek'

const CONFIG_DIR_NAME_BY_SOURCE: Record<ClaudeTranscriptUsageSource, string> = {
  claude: '.claude',
  deepseek: DEEPSEEK_CLAUDE_CONFIG_DIR_NAME
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
  const configDir = join(home, CONFIG_DIR_NAME_BY_SOURCE[source])
  return [join(configDir, 'projects'), join(configDir, 'transcripts')]
}

// Why local home only: Claude usage never scanned WSL homes, and DeepSeek is refused over SSH.
export async function listClaudeTranscriptFiles(
  source: ClaudeTranscriptUsageSource = 'claude'
): Promise<string[]> {
  const files = await Promise.all(
    getClaudeTranscriptRoots(source).map(async (root) => {
      try {
        return await walkJsonlFiles(root)
      } catch {
        return []
      }
    })
  )
  return [...new Set(files.flat())].sort()
}
