import { describe, expect, it } from 'vitest'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from './tui-agent-detection-commands'

describe('tui agent detection commands', () => {
  it('requires Claude before reporting Claude Agent Teams', () => {
    const commands = KNOWN_TUI_AGENT_DETECTION_COMMANDS.filter(
      (command) => command.id === 'claude-agent-teams'
    )

    expect(commands).toEqual([
      {
        id: 'claude-agent-teams',
        cmd: 'dolphin',
        requiredCommands: ['claude'],
        providedRuntimes: ['wsl']
      },
      {
        id: 'claude-agent-teams',
        cmd: 'dolphin-dev',
        requiredCommands: ['claude'],
        providedRuntimes: ['wsl']
      },
      {
        id: 'claude-agent-teams',
        cmd: 'dolphin-ide',
        requiredCommands: ['claude'],
        providedRuntimes: ['wsl']
      }
    ])
    expect(getTuiAgentDetectionProbeCommands(commands, 'linux')).toEqual([
      'dolphin',
      'claude',
      'dolphin-dev',
      'dolphin-ide'
    ])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['dolphin']), 'linux')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['dolphin', 'claude']), 'linux')).toEqual([
      'claude-agent-teams'
    ])
    expect(getTuiAgentDetectionProbeCommands(commands, 'win32')).toEqual([
      'dolphin',
      'claude',
      'dolphin-dev',
      'dolphin-ide'
    ])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['dolphin']), 'win32')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['dolphin', 'claude']), 'win32')).toEqual([
      'claude-agent-teams'
    ])
    // WSL terminals always carry the managed CLI, so only the distro's claude is probed.
    expect(getTuiAgentDetectionProbeCommands(commands, 'wsl')).toEqual(['claude'])
    expect(resolveDetectedTuiAgentIds(commands, new Set(), 'wsl')).toEqual([])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['claude']), 'wsl')).toEqual([
      'claude-agent-teams'
    ])
  })
})
