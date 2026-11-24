import type { AgentHookSource } from '../../shared/agent-hook-relay'
import { DOLPHIN_HOOK_RAW_JSON_TRANSPORT } from '../../shared/agent-hook-types'

/** Sent by a hook that prints the listener's response body, so the listener may answer a prompt. */
export const AGENT_HOOK_DECISION_REPLY_HEADER = 'X-Dolphin-Agent-Hook-Decision-Reply'

export function buildPosixAgentHookPostCommand(
  source: AgentHookSource,
  options: { curlCommand?: string; indent?: string; relaysDecision?: boolean } = {}
): string[] {
  const curlCommand = options.curlCommand ?? 'curl'
  const indent = options.indent ?? '  '
  const decisionHeader = options.relaysDecision
    ? [`  ${indent}-H "${AGENT_HOOK_DECISION_REPLY_HEADER}: 1" \\`]
    : []
  return [
    `if [ "\${DOLPHIN_AGENT_HOOK_TRANSPORT:-}" = "${DOLPHIN_HOOK_RAW_JSON_TRANSPORT}" ] && command -v base64 >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then`,
    `  dolphin_hook_metadata=$(printf '%s\\037%s\\037%s\\037%s\\037%s\\037%s' "$DOLPHIN_PANE_KEY" "$DOLPHIN_TAB_ID" "$DOLPHIN_AGENT_LAUNCH_TOKEN" "$DOLPHIN_WORKTREE_ID" "$DOLPHIN_AGENT_HOOK_ENV" "$DOLPHIN_AGENT_HOOK_VERSION" | base64 | tr -d '\\n') && \\`,
    `  [ -n "$dolphin_hook_metadata" ] && \\`,
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${DOLPHIN_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/json" \\`,
    `  ${indent}-H "X-Dolphin-Agent-Hook-Token: \${DOLPHIN_AGENT_HOOK_TOKEN}" \\`,
    ...decisionHeader,
    `  ${indent}-H "X-Dolphin-Agent-Hook-Meta-Encoding: base64" \\`,
    `  ${indent}-H "X-Dolphin-Agent-Hook-Meta: \${dolphin_hook_metadata}" \\`,
    `  ${indent}--data-binary @-`,
    'else',
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${DOLPHIN_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  ${indent}-H "X-Dolphin-Agent-Hook-Token: \${DOLPHIN_AGENT_HOOK_TOKEN}" \\`,
    ...decisionHeader,
    `  ${indent}--data-urlencode "paneKey=\${DOLPHIN_PANE_KEY}" \\`,
    `  ${indent}--data-urlencode "tabId=\${DOLPHIN_TAB_ID}" \\`,
    `  ${indent}--data-urlencode "launchToken=\${DOLPHIN_AGENT_LAUNCH_TOKEN}" \\`,
    `  ${indent}--data-urlencode "worktreeId=\${DOLPHIN_WORKTREE_ID}" \\`,
    `  ${indent}--data-urlencode "env=\${DOLPHIN_AGENT_HOOK_ENV}" \\`,
    `  ${indent}--data-urlencode "version=\${DOLPHIN_AGENT_HOOK_VERSION}" \\`,
    `  ${indent}--data-urlencode "payload@-"`,
    'fi'
  ]
}
