import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  dolphindBunRuntimeFilename
} from '../../shared/dolphind-artifacts'
import { assertPosixDolphindHost } from './dolphind-remote-host-support'
import { shellEscape } from './ssh-connection-utils'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'

/** Only legacy slots may use host Node; an incomplete Bun slot must not change runtimes. */
export function selectDolphindSlotRuntimeCommand(
  host: RemoteHostPlatform,
  directory: string,
  legacyNodePath: string
): string {
  assertPosixDolphindHost(host)
  const runtime = shellEscape(joinRemotePath(host, directory, dolphindBunRuntimeFilename(host.os)))
  const target = shellEscape(joinRemotePath(host, directory, DOLPHIND_BUILD_TARGET_FILENAME))
  return (
    `if [ -e ${target} ] || [ -e ${runtime} ]; then ` +
    `[ -x ${runtime} ] || exit 78; dolphind_runtime=${runtime}; ` +
    `else dolphind_runtime=${shellEscape(legacyNodePath)}; fi`
  )
}
