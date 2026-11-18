import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const config = require('../electron-builder.config.cjs')
const entitlements = readFileSync(
  resolve(import.meta.dirname, '../../resources/build/entitlements.mac.plist'),
  'utf8'
)

// Why: TCC aborts the responsible process (Dolphin) when a terminal tool asks for a
// protected class whose usage string is missing, instead of showing a prompt.
const TERMINAL_TOOL_PRIVACY_CLASSES = [
  {
    entitlement: 'com.apple.security.personal-information.addressbook',
    usageKeys: ['NSContactsUsageDescription']
  },
  {
    entitlement: 'com.apple.security.personal-information.calendars',
    usageKeys: [
      'NSCalendarsUsageDescription',
      'NSCalendarsFullAccessUsageDescription',
      'NSRemindersUsageDescription',
      'NSRemindersFullAccessUsageDescription'
    ]
  },
  {
    entitlement: 'com.apple.security.personal-information.location',
    usageKeys: ['NSLocationUsageDescription']
  },
  { entitlement: 'com.apple.security.device.camera', usageKeys: ['NSCameraUsageDescription'] },
  {
    entitlement: 'com.apple.security.device.audio-input',
    usageKeys: ['NSMicrophoneUsageDescription']
  }
]

describe('macOS privacy declarations for terminal-launched tools', () => {
  it.each(TERMINAL_TOOL_PRIVACY_CLASSES)(
    'declares $entitlement with its usage descriptions',
    ({ entitlement, usageKeys }) => {
      expect(entitlements).toContain(`<key>${String(entitlement)}</key>`)
      for (const key of usageKeys) {
        expect(config.mac.extendInfo[key]).toEqual(expect.stringMatching(/\S/))
      }
    }
  )
})
