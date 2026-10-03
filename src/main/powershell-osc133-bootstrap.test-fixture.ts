import { expect } from 'vitest'
import {
  POWERSHELL_BOOTSTRAP_ENV,
  POWERSHELL_BOOTSTRAP_ENV_STUB
} from './powershell-osc133-bootstrap'

/** The payload-free PowerShell PTY argv: identical for every cwd and startup command. */
export const POWERSHELL_BOOTSTRAP_STUB_ARGS = [
  '-NoLogo',
  '-NoExit',
  '-Command',
  POWERSHELL_BOOTSTRAP_ENV_STUB
] as const

/** Asserts the env-delivered launch shape and returns the script the stub will run. */
export function readPowerShellBootstrapScript(
  args: readonly string[] | null | undefined,
  env: Record<string, string> | undefined
): string {
  expect(args).toEqual(POWERSHELL_BOOTSTRAP_STUB_ARGS)
  const script = env?.[POWERSHELL_BOOTSTRAP_ENV]
  if (script === undefined) {
    throw new Error(`${POWERSHELL_BOOTSTRAP_ENV} is missing from the spawn env`)
  }
  return script
}
