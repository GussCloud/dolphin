import { RuntimeClientError } from './runtime/types'

const DURATION_UNITS_IN_DAYS: Record<string, number> = { h: 1 / 24, d: 1, w: 7 }
const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4
}

/** `30d`, `12h`, `2w` → days. */
export function parseGcAgeDays(value: string): number {
  const match = /^(\d+(?:\.\d+)?)([hdw])$/i.exec(value.trim())
  const days = match
    ? Number(match[1]) * DURATION_UNITS_IN_DAYS[match[2].toLowerCase()]
    : Number.NaN
  if (!Number.isFinite(days) || days <= 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--older-than expects a duration like 30d, 12h, or 2w; got "${value}".`
    )
  }
  return days
}

/** `5GB`, `500MB`, `1024` → bytes. */
export function parseGcMaxBytes(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i.exec(value.trim())
  const bytes = match
    ? Math.floor(Number(match[1]) * SIZE_UNITS[(match[2] ?? 'b').toLowerCase()])
    : Number.NaN
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--max-size expects a size like 5GB or 500MB; got "${value}".`
    )
  }
  return bytes
}
