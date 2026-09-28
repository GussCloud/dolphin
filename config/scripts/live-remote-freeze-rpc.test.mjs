import { describe, expect, it } from 'vitest'
import {
  appendDolphinRpcOutput,
  resolveDolphinCliCommand,
  resolveDolphinCliInvocation
} from './live-remote-freeze-rpc.mjs'

describe('live remote freeze RPC', () => {
  it('resolves the Dolphin CLI for managed, dev, Linux, and default runtimes', () => {
    expect(resolveDolphinCliCommand({ env: { DOLPHIN_CLI_COMMAND: 'custom-dolphin' } })).toBe(
      'custom-dolphin'
    )
    expect(resolveDolphinCliCommand({ env: { DOLPHIN_DEV_REPO_ROOT: '/repo' } })).toBe(
      'dolphin-dev'
    )
    expect(resolveDolphinCliCommand({ env: {}, platform: 'linux' })).toBe('dolphin-ide')
    expect(resolveDolphinCliCommand({ env: {}, platform: 'win32' })).toBe('dolphin')
  })

  it('bypasses the Windows dev cmd shim with the built Node CLI', () => {
    const invocation = resolveDolphinCliInvocation({
      env: {
        APPDATA: 'C:\\Users\\dev\\AppData\\Roaming',
        DOLPHIN_CLI_COMMAND: 'C:\\repo\\out\\bin\\dolphin-dev.cmd',
        DOLPHIN_DEV_REPO_ROOT: 'C:\\repo'
      },
      platform: 'win32',
      nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe'
    })

    expect(invocation).toMatchObject({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      prefixArgs: ['C:\\repo\\out\\cli\\index.js'],
      env: {
        DOLPHIN_USER_DATA_PATH: 'C:\\Users\\dev\\AppData\\Roaming\\dolphin-dev',
        DOLPHIN_DEV_CLI_INVOCATION: '1',
        DOLPHIN_APP_EXECUTABLE: 'C:\\repo\\node_modules\\electron\\dist\\electron.exe',
        DOLPHIN_APP_EXECUTABLE_NEEDS_APP_ROOT: '1'
      }
    })
  })

  it('caps combined asynchronous output before retaining the overflow chunk', () => {
    const first = appendDolphinRpcOutput('', '1234', 0, 5)
    expect(first).toEqual({ output: '1234', bytes: 4, exceeded: false })

    const overflow = appendDolphinRpcOutput(first.output, '67', first.bytes, 5)
    expect(overflow).toEqual({ output: '1234', bytes: 6, exceeded: true })
  })
})
