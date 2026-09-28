import { randomUUID } from 'node:crypto'
import { DOLPHIND_BUN_VERSION } from '../../shared/dolphind-bun-runtime'
import { dolphindBunRuntimeFilename } from '../../shared/dolphind-artifacts'
import {
  DOLPHIND_PROFILE_PREFLIGHT_FLAG,
  DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS,
  parseDolphindProfilePreflight
} from '../../shared/dolphind-profile-preflight'
import { assertPosixDolphindHost } from './dolphind-remote-host-support'
import { execCommand } from './ssh-relay-deploy-helpers'
import { shellEscape } from './ssh-connection-utils'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'
import type { SshConnection } from './ssh-connection'

export function dolphindProfilePreflightCommand(
  host: RemoteHostPlatform,
  directory: string,
  nonce: string
): string {
  assertPosixDolphindHost(host)
  return [
    'DOLPHIN_BACKGROUND_LAUNCH=1',
    shellEscape(joinRemotePath(host, directory, dolphindBunRuntimeFilename(host.os))),
    shellEscape(joinRemotePath(host, directory, 'dolphind.js')),
    DOLPHIND_PROFILE_PREFLIGHT_FLAG,
    shellEscape(nonce)
  ].join(' ')
}

/** Failure leaves the incumbent and its data untouched, including an unconfirmed SSH exit. */
export async function preflightInstalledDolphind(options: {
  conn: SshConnection
  host: RemoteHostPlatform
  remoteInstallDir: string
  fullVersion: string
  signal?: AbortSignal
}): Promise<void> {
  const nonce = randomUUID()
  const output = await execCommand(
    options.conn,
    dolphindProfilePreflightCommand(options.host, options.remoteInstallDir, nonce),
    { signal: options.signal, timeoutMs: DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS }
  )
  parseDolphindProfilePreflight(output, nonce, DOLPHIND_BUN_VERSION, options.fullVersion)
}
