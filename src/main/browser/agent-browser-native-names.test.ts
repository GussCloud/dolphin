import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {} }))

import { agentBrowserNativeNames } from './agent-browser-bridge-process'

describe('agentBrowserNativeNames', () => {
  it('uses the native binary where upstream ships one', () => {
    expect(agentBrowserNativeNames('win32', 'x64')).toEqual(['agent-browser-win32-x64.exe'])
    expect(agentBrowserNativeNames('darwin', 'arm64')).toEqual(['agent-browser-darwin-arm64'])
    expect(agentBrowserNativeNames('linux', 'arm64')).toEqual(['agent-browser-linux-arm64'])
  })

  it('falls back to the emulated x64 exe on Windows arm64', () => {
    expect(agentBrowserNativeNames('win32', 'arm64')).toEqual([
      'agent-browser-win32-arm64.exe',
      'agent-browser-win32-x64.exe'
    ])
  })
})
