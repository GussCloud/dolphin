// Kept apart from deepseek-config-home-setup so the autonomous-goal trust writer can seed
// onboarding without importing the launch-env and hook-install graph.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CLAUDE_STATE_FILE_NAME = '.claude.json'

/**
 * Marks Claude Code's first-run onboarding done in the DeepSeek config home. Verified with
 * claude 2.1.309: a fresh CLAUDE_CONFIG_DIR opens the theme picker, which would swallow the
 * prompt Dolphin types after start. The per-folder trust dialog is left to the user outside
 * autonomous goals (see autonomous-goal-claude-trust.ts).
 */
export function seedDeepSeekClaudeOnboarding(configDir: string): void {
  mkdirSync(configDir, { recursive: true })
  try {
    // Why 'wx': Claude owns an existing file (and a concurrent spawn may have just written one).
    writeFileSync(
      join(configDir, CLAUDE_STATE_FILE_NAME),
      `${JSON.stringify({ hasCompletedOnboarding: true }, null, 2)}\n`,
      { flag: 'wx' }
    )
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
}
