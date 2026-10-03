import { describe, expect, it } from 'vitest'

import { windowsParallelCheckoutGitArgs } from './windows-parallel-checkout-git-args'

describe('windowsParallelCheckoutGitArgs', () => {
  it('enables parallel checkout for a Windows drive path', () => {
    expect(windowsParallelCheckoutGitArgs('C:\\Users\\dev\\repo', 'win32')).toEqual([
      '-c',
      'checkout.workers=0'
    ])
  })

  it.each(['darwin', 'linux'] as const)('returns nothing on %s', (platform) => {
    expect(windowsParallelCheckoutGitArgs('/home/dev/repo', platform)).toEqual([])
  })

  it.each(['\\\\wsl.localhost\\Ubuntu\\home\\dev\\repo', '\\\\wsl$\\Ubuntu\\home\\dev\\repo'])(
    'returns nothing for the WSL UNC path %s',
    (cwd) => {
      expect(windowsParallelCheckoutGitArgs(cwd, 'win32')).toEqual([])
    }
  )

  it('never mutates the shared constant', () => {
    const first = windowsParallelCheckoutGitArgs('C:\\repo', 'win32')
    first.push('--bogus')
    expect(windowsParallelCheckoutGitArgs('C:\\repo', 'win32')).toEqual([
      '-c',
      'checkout.workers=0'
    ])
  })
})
