import { DolphindBindAddressError } from './dolphind-bind-address'
import { DolphindBundledRuntimeError } from './dolphind-bundled-runtime'
import { DolphindInstanceLockError } from './dolphind-instance-lock'
import { ProfileStateAccessError } from '../persistence/profile-state/profile-state-access'

export const DOLPHIND_EXIT_OK = 0
export const DOLPHIND_EXIT_FAILED = 1
export const DOLPHIND_EXIT_CONFIGURATION = 78

/** Configuration faults cannot be repaired by a supervisor restart. */
export function resolveDolphindExitCode(error: unknown): number {
  return error instanceof DolphindInstanceLockError ||
    error instanceof DolphindBindAddressError ||
    error instanceof DolphindBundledRuntimeError ||
    error instanceof ProfileStateAccessError
    ? DOLPHIND_EXIT_CONFIGURATION
    : DOLPHIND_EXIT_FAILED
}
