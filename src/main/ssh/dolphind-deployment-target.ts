import type { DolphindBunTarget } from '../../shared/dolphind-bun-runtime'
import type { SshConnection } from './ssh-connection'
import { execCommand } from './ssh-relay-deploy-helpers'
import type { RemoteHostPlatform } from './ssh-remote-platform'

export function parseDolphindLinuxLibc(output: string): 'glibc' | 'musl' {
  if (/\bmusl\b/i.test(output)) {
    return 'musl'
  }
  if (/\b(?:glibc|GNU libc|GNU C Library)\b/i.test(output)) {
    return 'glibc'
  }
  throw new Error('Could not identify the host C library for the bundled Dolphin runtime')
}

export async function resolveDolphindDeploymentTarget(options: {
  conn: SshConnection
  host: RemoteHostPlatform
  signal?: AbortSignal
  exec?: (command: string) => Promise<string>
}): Promise<DolphindBunTarget> {
  const { host } = options
  if (host.os !== 'linux') {
    return `${host.os}-${host.arch}`
  }
  const exec =
    options.exec ??
    ((command: string) => execCommand(options.conn, command, { signal: options.signal }))
  let output = await exec('ldd --version 2>&1 || true')
  try {
    return `linux-${host.arch}-${parseDolphindLinuxLibc(output)}`
  } catch {
    output = await exec(
      'getconf GNU_LIBC_VERSION 2>/dev/null || ' +
        'for loader in /lib/ld-musl-*.so.1; do [ ! -e "$loader" ] || { echo musl; break; }; done'
    )
  }
  return `linux-${host.arch}-${parseDolphindLinuxLibc(output)}`
}
