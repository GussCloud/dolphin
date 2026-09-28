import { homedir, tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppPathName } from '../../shared/app-environment'
import {
  resolveDolphindInstallRoot,
  resolveDolphindPath,
  resolveUserDataPath
} from './dolphind-app-paths'

const ALL_PATH_NAMES: AppPathName[] = [
  'userData',
  'home',
  'appData',
  'temp',
  'downloads',
  'logs',
  'exe'
]

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { configurable: true, value })
}

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform)
  vi.unstubAllEnvs()
})

describe('resolveUserDataPath', () => {
  it('prefers DOLPHIN_USER_DATA, then XDG_DATA_HOME, then ~/.dolphin', () => {
    vi.stubEnv('DOLPHIN_USER_DATA', join(sep, 'srv', 'dolphin-state'))
    vi.stubEnv('XDG_DATA_HOME', join(sep, 'xdg'))
    expect(resolveUserDataPath()).toBe(join(sep, 'srv', 'dolphin-state'))

    vi.stubEnv('DOLPHIN_USER_DATA', '')
    expect(resolveUserDataPath()).toBe(join(sep, 'xdg', 'Dolphin'))

    vi.stubEnv('XDG_DATA_HOME', '')
    expect(resolveUserDataPath()).toBe(join(homedir(), '.dolphin'))
  })
})

describe('resolveDolphindPath', () => {
  it('answers every path name without ever falling back to the data directory', () => {
    vi.stubEnv('DOLPHIN_USER_DATA', join(sep, 'srv', 'dolphin-state'))
    const answers = new Map(ALL_PATH_NAMES.map((name) => [name, resolveDolphindPath(name)]))

    for (const [name, answer] of answers) {
      expect(answer, `${name} answered nothing`).toBeTruthy()
      if (name !== 'userData') {
        // The catch-all this replaced returned the data directory for four of seven
        // names, 'exe' included — a data directory is not an executable.
        expect(answer, `${name} answered the userData directory`).not.toBe(
          join(sep, 'srv', 'dolphin-state')
        )
      }
    }
  })

  it("answers 'exe' with the Node binary running this process", () => {
    expect(resolveDolphindPath('exe')).toBe(process.execPath)
  })

  it("keeps 'logs' inside the data root so the whole deployment is one directory", () => {
    vi.stubEnv('DOLPHIN_USER_DATA', join(sep, 'srv', 'dolphin-state'))
    expect(resolveDolphindPath('logs')).toBe(join(sep, 'srv', 'dolphin-state', 'logs'))
  })

  it("answers 'home' and 'temp' from the OS", () => {
    expect(resolveDolphindPath('home')).toBe(homedir())
    expect(resolveDolphindPath('temp')).toBe(tmpdir())
  })

  it("answers 'appData' with the per-user application-data root of each platform", () => {
    setPlatform('darwin')
    expect(resolveDolphindPath('appData')).toBe(join(homedir(), 'Library', 'Application Support'))

    setPlatform('win32')
    vi.stubEnv('APPDATA', join('C:', 'Users', 'dolphin', 'AppData', 'Roaming'))
    expect(resolveDolphindPath('appData')).toBe(
      join('C:', 'Users', 'dolphin', 'AppData', 'Roaming')
    )
    vi.stubEnv('APPDATA', '')
    expect(resolveDolphindPath('appData')).toBe(join(homedir(), 'AppData', 'Roaming'))

    setPlatform('linux')
    vi.stubEnv('XDG_CONFIG_HOME', join(sep, 'xdg-config'))
    expect(resolveDolphindPath('appData')).toBe(join(sep, 'xdg-config'))
    vi.stubEnv('XDG_CONFIG_HOME', '')
    expect(resolveDolphindPath('appData')).toBe(join(homedir(), '.config'))
  })

  it("answers 'downloads' from XDG_DOWNLOAD_DIR before the home default", () => {
    vi.stubEnv('XDG_DOWNLOAD_DIR', join(sep, 'srv', 'incoming'))
    expect(resolveDolphindPath('downloads')).toBe(join(sep, 'srv', 'incoming'))

    vi.stubEnv('XDG_DOWNLOAD_DIR', '')
    expect(resolveDolphindPath('downloads')).toBe(join(homedir(), 'Downloads'))
  })
})

describe('resolveDolphindInstallRoot', () => {
  it('is the directory holding the running bundle, not the working directory', () => {
    expect(resolveDolphindInstallRoot(join(sep, 'opt', 'dolphin', 'dolphind.js'))).toBe(
      join(sep, 'opt', 'dolphin')
    )
  })

  it('absolutizes a relative script path against the working directory', () => {
    expect(resolveDolphindInstallRoot(join('out', 'dolphind', 'dolphind.js'))).toBe(
      join(process.cwd(), 'out', 'dolphind')
    )
  })

  it('refuses instead of guessing when the process has no main script', () => {
    const originalArgv = process.argv
    // `node -e` leaves argv[1] unset; cwd would be a guess, not an answer.
    process.argv = [process.execPath]
    try {
      expect(() => resolveDolphindInstallRoot()).toThrow(/dolphind_install_root_unavailable/)
    } finally {
      process.argv = originalArgv
    }
  })
})
