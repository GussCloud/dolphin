import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectDir = resolve(import.meta.dirname, '../..')

describe('release blocker safeguards', () => {
  // Why the fork's own line: Dolphin updates only from its own releases, so it is not held to
  // upstream Dolphin's stable version floor.
  it('keeps the root package version on the fork release line', () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectDir, 'package.json'), 'utf8'))
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(packageJson.version)
    expect(match).not.toBeNull()
    const version = match.slice(1, 4).map(Number)
    const isAtLeastStable = version[0] > 0 || version[1] >= 1
    expect(isAtLeastStable).toBe(true)
  })
})
