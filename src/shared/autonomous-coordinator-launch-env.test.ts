import { describe, expect, it } from 'vitest'
import {
  buildAutonomousCoordinatorLaunchEnv,
  coordinatorTranscriptPlatform,
  isClaudeAutoCompactDisabledEnv,
  isCoordinatorContextMeasurable
} from './autonomous-coordinator-launch-env'

describe('autonomous coordinator launch env', () => {
  it('turns auto-compaction off for every Claude Code coordinator on a readable host', () => {
    for (const agent of ['claude-agent-teams', 'deepseek', 'deepseek-agent-teams']) {
      expect(
        buildAutonomousCoordinatorLaunchEnv({ agent, transcriptReadableOnHost: true })
      ).toEqual({ DISABLE_AUTO_COMPACT: '1' })
    }
  })

  it('asks for the orchestration channel only for a plain Claude coordinator', () => {
    expect(
      buildAutonomousCoordinatorLaunchEnv({ agent: 'claude', transcriptReadableOnHost: true })
    ).toEqual({ DISABLE_AUTO_COMPACT: '1', DOLPHIN_AUTONOMOUS_COORDINATOR_CHANNEL: '1' })
    expect(
      buildAutonomousCoordinatorLaunchEnv({ agent: 'claude', transcriptReadableOnHost: false })
    ).toEqual({})
  })

  it('leaves Codex, other agents and SSH/WSL hosts alone', () => {
    expect(
      buildAutonomousCoordinatorLaunchEnv({ agent: 'codex', transcriptReadableOnHost: true })
    ).toEqual({})
    expect(
      buildAutonomousCoordinatorLaunchEnv({ agent: 'gemini', transcriptReadableOnHost: true })
    ).toEqual({})
    expect(
      buildAutonomousCoordinatorLaunchEnv({ agent: 'claude', transcriptReadableOnHost: false })
    ).toEqual({})
  })

  it('measures context only for a local coordinator on the host platform', () => {
    const host = { remote: false, launchPlatform: 'win32', hostPlatform: 'win32' } as const
    expect(isCoordinatorContextMeasurable(host)).toBe(true)
    expect(isCoordinatorContextMeasurable({ ...host, remote: true })).toBe(false)
    expect(isCoordinatorContextMeasurable({ ...host, launchPlatform: 'linux' })).toBe(false)
  })

  it('reads a POSIX transcript path on Windows as a WSL one', () => {
    expect(coordinatorTranscriptPlatform('/home/me/t.jsonl', 'win32')).toBe('linux')
    expect(coordinatorTranscriptPlatform('C:/Users/me/t.jsonl', 'win32')).toBe('win32')
    expect(coordinatorTranscriptPlatform('\\\\wsl.localhost\\U\\t.jsonl', 'win32')).toBe('win32')
    expect(coordinatorTranscriptPlatform('/home/me/t.jsonl', 'darwin')).toBe('darwin')
  })

  it('treats an unset, empty or 0 flag as auto-compaction on', () => {
    expect(isClaudeAutoCompactDisabledEnv({ DISABLE_AUTO_COMPACT: '1' })).toBe(true)
    expect(isClaudeAutoCompactDisabledEnv({ DISABLE_AUTO_COMPACT: '0' })).toBe(false)
    expect(isClaudeAutoCompactDisabledEnv({})).toBe(false)
    expect(isClaudeAutoCompactDisabledEnv(undefined)).toBe(false)
  })
})
