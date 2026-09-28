import { z } from 'zod'

export const DOLPHIND_PROFILE_PREFLIGHT_FLAG = '--dolphind-profile-state-preflight'
export const DOLPHIND_STARTUP_PREFLIGHT_FLAG = '--dolphind-startup-preflight'
export const DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS = 90_000
// Server startup follows the disposable native/SQLite probe on every bundled launch.
export const DOLPHIND_STARTUP_READINESS_TIMEOUT_MS = DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS + 90_000

export const dolphindProfilePreflightResponseSchema = z.object({
  type: z.literal('dolphin_profile_state_ready'),
  nonce: z.string().uuid(),
  runtime: z.enum(['node', 'bun']),
  runtimeVersion: z.string().min(1),
  artifactVersion: z.string().regex(/^\d+\.\d+\.\d+\+[a-f0-9]{12}$/),
  sqliteVersion: z.string().min(1),
  revision: z.number().int().positive()
})

export type DolphindProfilePreflightResponse = z.infer<
  typeof dolphindProfilePreflightResponseSchema
>

/** A fresh challenge prevents stale or unrelated output from admitting a candidate. */
export function parseDolphindProfilePreflight(
  output: string,
  nonce: string,
  runtimeVersion: string,
  artifactVersion?: string
): DolphindProfilePreflightResponse {
  const response = dolphindProfilePreflightResponseSchema.parse(JSON.parse(output.trim()))
  if (
    response.nonce !== nonce ||
    response.runtime !== 'bun' ||
    response.runtimeVersion !== runtimeVersion ||
    (artifactVersion !== undefined && response.artifactVersion !== artifactVersion)
  ) {
    throw new Error('Profile preflight did not run under the expected candidate runtime')
  }
  return response
}
