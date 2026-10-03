import { describe, expect, it } from 'vitest'
import { createWorktreeCreateTimingRecorder } from './worktree-create-timing'
import {
  runWithTerminalSpawnTiming,
  timeTerminalSpawnStep
} from './worktree-create-terminal-spawn-timing'

async function spawnDeepInRuntime(): Promise<string> {
  const env = await timeTerminalSpawnStep('agent_teams_plan', async () => 'env')
  await Promise.resolve()
  return timeTerminalSpawnStep('daemon_create_or_attach', async () => `${env}:pty`)
}

describe('terminal spawn timing', () => {
  it('records nested steps on the recorder that wraps the spawn', async () => {
    const recorder = createWorktreeCreateTimingRecorder()

    const result = await runWithTerminalSpawnTiming(recorder, spawnDeepInRuntime)

    expect(result).toBe('env:pty')
    expect(recorder.finish().phases.map((phase) => phase.phase)).toEqual([
      'terminal_agent_teams_plan',
      'terminal_daemon_create_or_attach'
    ])
  })

  it('runs steps untimed outside a worktree create', async () => {
    const recorder = createWorktreeCreateTimingRecorder()

    await expect(spawnDeepInRuntime()).resolves.toBe('env:pty')
    expect(recorder.finish().phases).toEqual([])
  })

  it('does not leak steps into a terminal created concurrently outside the scope', async () => {
    const recorder = createWorktreeCreateTimingRecorder()

    await Promise.all([
      runWithTerminalSpawnTiming(recorder, spawnDeepInRuntime),
      spawnDeepInRuntime()
    ])

    expect(recorder.finish().phases).toHaveLength(2)
  })
})
