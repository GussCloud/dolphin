import type { SshConnectionState, SshConnectionStatus } from '../../../src/shared/ssh-types'
import { translateTasks as t } from './tasks-translate'

/**
 * What mobile stores for an SSH connection.
 *
 * SshConnectionState with the two members no mobile reader touches left optional. The host always
 * sends them (public-ssh-state.ts:8 writes `error` explicitly and `reconnectAttempt` has been on
 * the type since #590), so this widens nothing on the wire; it exists so a reply that omits one
 * keeps its `status` instead of dropping the whole record into the connect path's `'connected'`
 * fallback.
 */
export type WorkspaceSshRecord = Omit<SshConnectionState, 'error' | 'reconnectAttempt'> & {
  error?: string | null
  reconnectAttempt?: number
}

export type WorkspaceSshGate = {
  status: SshConnectionStatus | null
  requiresConnection: boolean
  connectInProgress: boolean
  error: string | null
}

function isWorkspaceSshConnectInProgress(status: SshConnectionStatus | null): boolean {
  return status === 'connecting' || status === 'deploying-relay' || status === 'reconnecting'
}

export function workspaceSshStatusLabel(status: SshConnectionStatus | null): string {
  if (status === 'connected') {
    return t('sshConnected')
  }
  if (status === 'connecting') {
    return t('sshConnecting')
  }
  if (status === 'deploying-relay') {
    return t('sshDeployingRelay')
  }
  if (status === 'reconnecting') {
    return t('sshReconnecting')
  }
  if (status === 'auth-failed') {
    return t('sshAuthFailed')
  }
  if (status === 'reconnection-failed') {
    return t('sshReconnectFailed')
  }
  if (status === 'error') {
    return t('sshConnectionFailed')
  }
  return t('sshDisconnected')
}

export function deriveWorkspaceSshGate(args: {
  connectionId: string | null
  state: WorkspaceSshRecord | null
  connecting: boolean
}): WorkspaceSshGate {
  const matchingState =
    args.connectionId && args.state?.targetId === args.connectionId ? args.state : null
  const status = matchingState?.status ?? null
  return {
    status,
    requiresConnection: args.connectionId !== null && status !== 'connected',
    connectInProgress: args.connecting || isWorkspaceSshConnectInProgress(status),
    error: matchingState?.error ?? null
  }
}
