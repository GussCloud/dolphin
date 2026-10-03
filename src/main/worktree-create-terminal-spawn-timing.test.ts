import { describe, expect, it } from 'vitest'
import { createWorktreeCreateTimingRecorder } from './worktree-create-timing'
import {
  runWithTerminalSpawnTiming,
  timeTerminalSpawnStep,
  timeTerminalSpawnStepSync
} from './worktree-create-terminal-spawn-timing'

async function spawnDeepInRuntime(): Promise<string> {
  const env = timeTerminalSpawnStepSync('build_env', () => 'env')
  await Promise.resolve()
  return timeTerminalSpawnStep('pty_spawn', async () => `${env}:pty`)
}

describe('terminal spawn timing', () => {
  it('records nested steps on the recorder that wraps the spawn', async () => {
    const recorder = createWorktreeCreateTimingRecorder()

    const result = await runWithTerminalSpawnTiming(recorder, spawnDeepInRuntime)

    expect(result).toBe('env:pty')
    expect(recorder.finish().phases.map((phase) => phase.phase)).toEqual([
      'terminal_build_env',
      'terminal_pty_spawn'
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
