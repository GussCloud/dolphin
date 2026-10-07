// Why: route params can carry host/worktree ids; only known static segments survive.
const SAFE_ROUTE_SEGMENTS = new Set([
  'about',
  'accounts',
  'agent-history',
  'browser-settings',
  'connection-log',
  'edit',
  'files',
  'h',
  'history',
  'index',
  'mobile-onboarding',
  'native-chat-settings',
  'notification-opt-in',
  'notifications',
  'pair',
  'pair-confirm',
  'pair-scan',
  'pr',
  'preview',
  'review',
  'session',
  'settings',
  'source-control',
  'tasks',
  'terminal-settings',
  'troubleshoot',
  'voice-settings',
  '[hostId]',
  '[worktreeId]'
])

export function formatRouteTemplate(segments: readonly string[]): string {
  if (segments.length === 0) {
    return 'index'
  }
  return segments
    .map((segment) => (SAFE_ROUTE_SEGMENTS.has(segment) ? segment : '[dynamic]'))
    .join(' > ')
}
