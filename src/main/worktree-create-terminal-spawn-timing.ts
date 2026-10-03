import { AsyncLocalStorage } from 'node:async_hooks'
import type { WorktreeCreateTimingRecorder } from './worktree-create-timing'

/** Closed vocabulary: each step becomes a `worktree.create.phase.terminal_<step>_ms` span attribute. */
export type TerminalSpawnTimingStep =
  | 'resolve_workspace'
  | 'resolve_launch_options'
  | 'agent_teams_plan'
  | 'daemon_do_spawn'
  | 'daemon_preflight'
  | 'daemon_create_or_attach'
  | 'reveal'

// Why ALS: the steps live deep in the runtime and daemon client, whose option bags cross RPC boundaries.
const recorderStorage = new AsyncLocalStorage<WorktreeCreateTimingRecorder>()

export function runWithTerminalSpawnTiming<T>(
  recorder: WorktreeCreateTimingRecorder,
  operation: () => Promise<T>
): Promise<T> {
  return recorderStorage.run(recorder, operation)
}

export function timeTerminalSpawnStep<T>(
  step: TerminalSpawnTimingStep,
  operation: () => Promise<T>
): Promise<T> {
  const recorder = recorderStorage.getStore()
  return recorder ? recorder.time(`terminal_${step}`, operation) : operation()
}
