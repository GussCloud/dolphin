/**
 * One vocabulary for where a terminal session is in its life, independent of which layer
 * observed it. A session id outlives its process: restore attaches a new runtime to the same id.
 */
export type SessionLifecycleState =
  | 'creating'
  | 'starting'
  | 'running'
  | 'idle'
  | 'stopping'
  | 'terminated'
  | 'reaped'
  | 'restoring'
  | 'disconnected'
  | 'orphaned'
  | 'failed'

const TRANSITIONS: Record<SessionLifecycleState, readonly SessionLifecycleState[]> = {
  creating: ['starting', 'running', 'failed'],
  starting: ['running', 'failed'],
  running: ['idle', 'stopping', 'terminated', 'disconnected', 'orphaned', 'failed'],
  idle: ['running', 'stopping', 'terminated', 'disconnected', 'orphaned', 'failed'],
  stopping: ['terminated', 'failed'],
  // Why no way back to running: a restore is a new runtime under the same id, via 'restoring'.
  terminated: ['reaped', 'restoring'],
  reaped: ['restoring'],
  restoring: ['running', 'failed'],
  disconnected: ['running', 'restoring', 'stopping', 'orphaned', 'terminated'],
  orphaned: ['stopping', 'terminated', 'reaped'],
  failed: ['stopping', 'terminated', 'reaped', 'restoring']
}

export function canTransitionSessionLifecycle(
  from: SessionLifecycleState,
  to: SessionLifecycleState
): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}

/** States past which a session holds no process; a reaper may drop its bookkeeping. */
export function isSessionLifecycleFinished(state: SessionLifecycleState): boolean {
  return state === 'terminated' || state === 'reaped'
}

/** Projects the daemon's coarser per-session state onto the lifecycle vocabulary. */
export function projectDaemonSessionLifecycle(info: {
  state: 'created' | 'spawning' | 'running' | 'exiting' | 'exited'
  isAlive: boolean
}): SessionLifecycleState {
  if (!info.isAlive || info.state === 'exited') {
    return 'terminated'
  }
  switch (info.state) {
    case 'created':
      return 'creating'
    case 'spawning':
      return 'starting'
    case 'exiting':
      return 'stopping'
    case 'running':
      return 'running'
  }
}
