import { describe, expect, it } from 'vitest'
import { buildNotificationOptions } from './notification-options'

describe('orphan agent notifications', () => {
  it('names the process Dolphin stopped', () => {
    expect(
      buildNotificationOptions({
        source: 'orphan-agent-stopped',
        stoppedProcessLabel: 'node.exe (PID 4120)'
      })
    ).toEqual({
      title: 'Stopped an agent from a closed terminal',
      body: 'node.exe (PID 4120) kept reporting after its terminal closed.'
    })
  })
})
