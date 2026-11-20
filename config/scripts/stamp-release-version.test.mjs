import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stampDesktopVersion, stampMobileVersion } from './stamp-release-version.mjs'

let dirs = []

function tempJson(name, value) {
  const dir = mkdtempSync(join(tmpdir(), 'dolphin-stamp-'))
  dirs.push(dir)
  const path = join(dir, name)
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  return path
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

afterEach(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  dirs = []
})

describe('stampDesktopVersion', () => {
  it('rewrites only the version and keeps the file formatted', () => {
    const path = tempJson('package.json', {
      name: 'dolphin',
      version: '0.2.55',
      scripts: { a: 'b' }
    })
    stampDesktopVersion(path, '0.2.56-rc.1')
    expect(readJson(path)).toEqual({ name: 'dolphin', version: '0.2.56-rc.1', scripts: { a: 'b' } })
    expect(readFileSync(path, 'utf8')).toMatch(/^\{\n {2}"name"/)
  })

  it('refuses versions the updater channels do not recognise', () => {
    const path = tempJson('package.json', { version: '0.2.55' })
    expect(() => stampDesktopVersion(path, '0.2.56-beta.1')).toThrow(/X.Y.Z/)
    expect(readJson(path).version).toBe('0.2.55')
  })
})

describe('stampMobileVersion', () => {
  const appJson = {
    expo: { version: '0.0.65', ios: { buildNumber: '1' }, android: { versionCode: 32 } }
  }

  it('writes versionName and versionCode, leaving iOS to fastlane', () => {
    const path = tempJson('app.json', appJson)
    stampMobileVersion(path, '0.0.66', '6601')
    expect(readJson(path).expo).toEqual({
      version: '0.0.66',
      ios: { buildNumber: '1' },
      android: { versionCode: 6601 }
    })
  })

  it('refuses a versionCode below the committed one or a non-numeric version', () => {
    const path = tempJson('app.json', appJson)
    expect(() => stampMobileVersion(path, '0.0.66', '31')).toThrow(/below/)
    expect(() => stampMobileVersion(path, '0.0.66-rc.1', '6601')).toThrow(/X.Y.Z/)
    expect(readJson(path).expo.version).toBe('0.0.65')
  })
})
