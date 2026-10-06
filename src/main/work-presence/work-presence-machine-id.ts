import { createHash } from 'node:crypto'
import { hostname } from 'node:os'

// Why hashed with a domain tag: the id must be stable per install+profile but never equal
// (or be reversible to) the telemetry install id it derives from.
export function workPresenceMachineId(installId: string, profileId: string): string {
  return createHash('sha256')
    .update(`dolphin-work-presence\0${installId}\0${profileId}`)
    .digest('hex')
    .slice(0, 32)
}

export function workPresenceMachineLabel(): string {
  try {
    return hostname().trim()
  } catch {
    return ''
  }
}
