/** The managed Claude-compatible hook script, built for local, POSIX-remote and Windows targets.
 *  Split from hook-service.ts so the service owns install/status and this owns script text,
 *  mirroring the same split under src/main/cursor/. */
import { buildWindowsAgentHookCurlPostCommand } from '../agent-hooks/installer-utils'
import { buildPosixAgentHookPostCommand } from '../agent-hooks/hook-post-command'
// AGENT_HOOK_DECISION_REPLY_HEADER (hook-post-command.ts) gates the listener's decision.
import {
  buildPosixGrokReplayGuardLines,
  buildWindowsGrokReplayGuardLines
} from '../agent-hooks/grok-replay-guard'
import {
  WINDOWS_HOOK_STDIN_DRAIN_LABEL,
  buildPosixHookPayloadCapture,
  buildPosixHookSpoolLines,
  buildWindowsHookEnvironmentGuardLines,
  buildWindowsHookStdinDrainEpilogue
} from '../agent-hooks/hook-stdin-contract'

export function getManagedScript(
  target: 'local' | 'posix' = 'local',
  options: {
    skipWhenDevinImportsClaude?: boolean
    skipWhenGrokImportsClaude?: boolean
  } = {}
): string {
  if (target === 'local' && process.platform === 'win32') {
    return [
      '@echo off',
      'setlocal',
      // Why: Claude-compatible permission hooks fail closed on empty stdout (#14818).
      // Why not relay a permission decision here: the payload streams from stdin straight into
      // curl.exe, so the script cannot tell the event before answering without a temp-file
      // rewrite of the #11549 stdin contract; the listener only decides for hooks that send
      // AGENT_HOOK_DECISION_REPLY_HEADER, so this script keeps the user's prompt.
      'echo {}',
      // Why: refresh endpoint coordinates for PTYs surviving a Dolphin restart.
      'if defined DOLPHIN_AGENT_HOOK_ENDPOINT if exist "%DOLPHIN_AGENT_HOOK_ENDPOINT%" call "%DOLPHIN_AGENT_HOOK_ENDPOINT%" 2>nul',
      // Why (#11549): the env guards must outrank the Devin skip — the Devin skip parks in more.com,
      // and outside a Dolphin pane the caller can abandon stdin, so more.com never returns.
      ...buildWindowsHookEnvironmentGuardLines(),
      // Why: a backgrounded session runs in a daemon worker that inherited the dispatching
      // pane's env, so DOLPHIN_PANE_KEY names a pane this session does not run in (#9236).
      // Why exit, not the drain label: the drain parks in more.com and a worker is outside
      // a Dolphin pane — the abandoned-stdin hang #11549 guards against.
      'if not "%CLAUDE_JOB_DIR%"=="" exit /b 0',
      ...(options.skipWhenGrokImportsClaude ? buildWindowsGrokReplayGuardLines() : []),
      ...(options.skipWhenDevinImportsClaude
        ? [
            // Why: Devin imports .claude hooks by default; skip Dolphin's managed hook there so status posts stay attributed to Devin.
            `if not "%DEVIN_PROJECT_DIR%"=="" goto :${WINDOWS_HOOK_STDIN_DRAIN_LABEL}`
          ]
        : []),
      // Why: use curl.exe to avoid an extra PowerShell startup per hook.
      buildWindowsAgentHookCurlPostCommand('claude'),
      'exit /b 0',
      ...buildWindowsHookStdinDrainEpilogue(),
      ''
    ].join('\r\n')
  }

  return [
    '#!/bin/sh',
    // Why: Claude-compatible permission hooks fail closed on empty stdout (#14818), so every exit
    // path prints exactly one JSON object: `{}`, or the listener's PermissionRequest answer.
    "dolphin_hook_reply='{}'",
    'dolphin_hook_replied=',
    'dolphin_hook_print_reply() {',
    '  [ -n "$dolphin_hook_replied" ] && return 0',
    '  dolphin_hook_replied=1',
    '  printf \'%s\\n\' "$dolphin_hook_reply"',
    '}',
    'trap dolphin_hook_print_reply EXIT',
    ...buildPosixHookPayloadCapture(),
    // Why: only a PermissionRequest waits for the listener; every other event answers at once.
    `case "$payload" in *'"PermissionRequest"'*) ;; *) dolphin_hook_print_reply ;; esac`,
    ...(options.skipWhenGrokImportsClaude ? buildPosixGrokReplayGuardLines() : []),
    ...buildPosixHookSpoolLines('claude'),
    ...(options.skipWhenDevinImportsClaude
      ? [
          // Why: Devin imports .claude hooks by default; skip Dolphin's managed hook there so status posts stay attributed to Devin.
          'if [ -n "$DEVIN_PROJECT_DIR" ]; then',
          '  exit 0',
          'fi'
        ]
      : []),
    // Why: a backgrounded session runs in a daemon worker that inherited the dispatching
    // pane's env, so DOLPHIN_PANE_KEY names a pane this session does not run in (#9236).
    'if [ -n "$CLAUDE_JOB_DIR" ]; then',
    '  exit 0',
    'fi',
    // Why: refresh endpoint coordinates for PTYs surviving a Dolphin restart.
    // Why: suppress parse errors so they neither leak nor trip outer set -e.
    'if [ -n "$DOLPHIN_AGENT_HOOK_ENDPOINT" ] && [ -r "$DOLPHIN_AGENT_HOOK_ENDPOINT" ]; then',
    '  unset DOLPHIN_AGENT_HOOK_TRANSPORT',
    '  . "$DOLPHIN_AGENT_HOOK_ENDPOINT" 2>/dev/null || :',
    'fi',
    'if [ -z "$DOLPHIN_AGENT_HOOK_PORT" ] || [ -z "$DOLPHIN_AGENT_HOOK_TOKEN" ] || [ -z "$DOLPHIN_PANE_KEY" ]; then',
    '  spool_hook_event',
    '  exit 0',
    'fi',
    // Why: keep full hook JSON off the command line and avoid IDS-friendly URL-encoded paths.
    'dolphin_hook_response=$(',
    ...buildPosixAgentHookPostCommand('claude', { relaysDecision: true }).map(
      (line, index, lines) => (index === lines.length - 1 ? `${line} 2>/dev/null` : line)
    ),
    ') || spool_hook_event',
    `case "$dolphin_hook_response" in '{'*) dolphin_hook_reply=$dolphin_hook_response ;; esac`,
    'exit 0',
    ''
  ].join('\n')
}
