import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POWERSHELL_BOOTSTRAP_ENV } from '../../powershell-osc133-bootstrap'
import { POWERSHELL_BOOTSTRAP_STUB_ARGS } from '../../powershell-osc133-bootstrap.test-fixture'
import { createPtyShellLaunchPlan } from './shell-launch-plan'

describe('createPtyShellLaunchPlan PowerShell bootstrap env on POSIX', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', platform)
  })

  const baseOpts = { sessionId: 'pwsh', cols: 80, rows: 24, cwd: '/tmp', shellOverride: 'pwsh' }

  it('carries the bootstrap env alongside the stub args that read it', () => {
    const env: Record<string, string> = {}
    const plan = createPtyShellLaunchPlan(baseOpts, env)

    expect(plan.shellArgs).toEqual(POWERSHELL_BOOTSTRAP_STUB_ARGS)
    expect(env[POWERSHELL_BOOTSTRAP_ENV]).toBeTruthy()
  })

  it('drops the bootstrap env when terminal profile args replace the stub', () => {
    const env: Record<string, string> = {}
    const plan = createPtyShellLaunchPlan({ ...baseOpts, terminalShellArgs: ['-NoLogo'] }, env)

    expect(plan.shellArgs).toEqual(['-NoLogo'])
    // Nothing would delete it, so every child process would inherit the script.
    expect(env).not.toHaveProperty(POWERSHELL_BOOTSTRAP_ENV)
  })
})
