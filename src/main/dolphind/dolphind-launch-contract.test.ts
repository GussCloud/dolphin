/**
 * The two things a supervisor reads off a launch: what the arguments mean, and what an exit
 * code means. Both are part of the ops contract in docs/reference/dolphind-operations.md.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DOLPHIND_EXIT_CONFIGURATION,
  DOLPHIND_EXIT_FAILED,
  parseArgs,
  resolveDolphindExitCode
} from './dolphind-entry'
import { startDolphindWithLifecycle } from './dolphind-lifecycle'
import { DolphindBindAddressError } from './dolphind-bind-address'
import { DolphindInstanceLockError } from './dolphind-instance-lock'
import { ProfileStateAccessError } from '../persistence/profile-state/profile-state-access'
import { DolphindBundledRuntimeError } from './dolphind-bundled-runtime'

describe('parseArgs', () => {
  it('accepts --bind and leaves it unset when absent', () => {
    expect(parseArgs(['--bind', '0.0.0.0'])).toEqual({ bind: '0.0.0.0' })
    expect(parseArgs([])).toEqual({})
    expect(parseArgs(['--port', '6768', '--bind', '10.0.0.5', '--json'])).toEqual({
      port: 6768,
      bind: '10.0.0.5',
      json: true
    })
  })

  it('rejects --bind with no value rather than silently binding the default', () => {
    expect(() => parseArgs(['--bind'])).toThrow('--bind expects a value')
    expect(() => parseArgs(['--bind', '--json'])).not.toThrow()
  })
})

describe('resolveDolphindExitCode', () => {
  it('separates a configuration fault from a generic failure', () => {
    // A supervisor must be able to stop restarting on faults that restarting cannot fix:
    // a data root owned by someone else, held by another instance, or a bad bind address.
    expect(
      resolveDolphindExitCode(new DolphindInstanceLockError('dolphind_instance_lock_held', 'held'))
    ).toBe(DOLPHIND_EXIT_CONFIGURATION)
    expect(resolveDolphindExitCode(new DolphindBindAddressError('bad'))).toBe(
      DOLPHIND_EXIT_CONFIGURATION
    )
    expect(resolveDolphindExitCode(new ProfileStateAccessError('recovery interrupted'))).toBe(
      DOLPHIND_EXIT_CONFIGURATION
    )
    expect(resolveDolphindExitCode(new Error('port in use'))).toBe(DOLPHIND_EXIT_FAILED)
    expect(resolveDolphindExitCode(new DolphindBundledRuntimeError('partial installation'))).toBe(
      DOLPHIND_EXIT_CONFIGURATION
    )
    expect(DOLPHIND_EXIT_CONFIGURATION).not.toBe(DOLPHIND_EXIT_FAILED)
  })
})

describe('dolphind lifecycle cleanup', () => {
  it('uninstalls registered runtime resources when startup fails', async () => {
    const cleanupRuntime = vi.fn(async () => {})
    const cleanupHost = vi.fn(async () => {})

    await expect(
      startDolphindWithLifecycle(async (registerCleanup) => {
        registerCleanup(cleanupRuntime)
        await Promise.resolve()
        throw new Error('startup failed')
      }, cleanupHost)
    ).rejects.toThrow('startup failed')

    expect(cleanupRuntime).toHaveBeenCalledOnce()
    expect(cleanupHost).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('preserves the startup error when rollback also fails', async () => {
    const startupError = new Error('bind failed')
    const cleanupError = new Error('daemon stop failed')
    const cleanupRuntime = vi.fn(async () => {})
    const cleanupHost = vi.fn(async () => {
      throw cleanupError
    })
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        startDolphindWithLifecycle(async (registerCleanup) => {
          registerCleanup(cleanupRuntime)
          throw startupError
        }, cleanupHost)
      ).rejects.toBe(startupError)
      expect(report).toHaveBeenCalledWith('[dolphind] startup cleanup failed:', cleanupError)
    } finally {
      report.mockRestore()
    }
  })

  it('coalesces concurrent and repeated normal stops', async () => {
    const cleanupRuntime = vi.fn(async () => {})
    const cleanupHost = vi.fn(async () => {})
    const handle = await startDolphindWithLifecycle(async (registerCleanup) => {
      registerCleanup(cleanupRuntime)
      return { readiness: 'ready' }
    }, cleanupHost)

    await Promise.all([handle.stop(), handle.stop()])
    await handle.stop()

    expect(cleanupRuntime).toHaveBeenCalledOnce()
    expect(cleanupHost).toHaveBeenCalledOnce()
  })

  it('keeps the host aware of failed runtime teardown so it cannot release profile admission', async () => {
    const failure = new Error('profile writer still running')
    const cleanupHost = vi.fn(async () => {})
    const handle = await startDolphindWithLifecycle(async (registerCleanup) => {
      registerCleanup(async () => {
        throw failure
      })
      return {}
    }, cleanupHost)
    await expect(handle.stop()).rejects.toBe(failure)
    expect(cleanupHost).toHaveBeenCalledExactlyOnceWith(false)
  })
})
