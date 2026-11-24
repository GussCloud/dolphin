import { describe, expect, it } from 'vitest'
import {
  analyzeBypassRemoval,
  classifyBypassRemoval,
  classifyBypassRemovals
} from './bypass-removal-classifier'

const CWD = '/Users/g/dolphin/workspaces/repo'
const HOME = '/Users/g'
const WINDOWS_CWD = 'C:\\Users\\g\\work\\repo'

type Row = [command: string, expected: string[] | null, platform?: NodeJS.Platform]

function classify(command: string, platform: NodeJS.Platform = 'darwin') {
  const windows = platform === 'win32'
  return classifyBypassRemovals(command, windows ? WINDOWS_CWD : CWD, {
    homeDir: windows ? 'C:\\Users\\g' : HOME,
    platform
  })
}

// Every bypass found in review rounds 1 and 2: each must stay with the user.
const REVIEW_PROBES: string[] = [
  // round 1
  'rm -rf "$X"; ! rm -rf ~',
  'cd /Applications && rm -rf .',
  'cd /USERS/g && rm -rf .',
  'rm -rf /Users/g/dolphin',
  'find -L ~ -delete',
  'stdbuf -o0 rm -rf $X',
  'caffeinate rm -rf $X',
  'arch -arm64 rm -rf $X',
  'busybox rm -rf $X',
  'nice rm -rf $X',
  'timeout 5 rm -rf $X',
  'env rm -rf $X',
  'sudo rm -rf $X',
  'xargs rm -rf < list',
  'command rm -rf $X',
  'builtin rm -rf $X',
  'exec rm -rf $X',
  '! rm -rf $X',
  // round 2
  'find . $OPT -delete',
  'find . $(echo -exec) rm {} +',
  'find . -delete',
  'rm -rf link/..',
  'rm -rf ./link/..',
  'rm -rf link/',
  './rm -rf $X',
  'evil/rm -rf $X',
  'evil/echo x; rm -rf $X',
  'echo x > ~/.zshrc',
  'rm -rf $X > ~/.zshrc',
  'rm -rf $X 2>/dev/null',
  "bash -ic 'rm -rf $X'",
  "sh -c 'rm -rf $X'",
  // shape violations
  'rm -rf $X && echo done',
  'rm -rf $X | cat',
  'rm -rf $X &',
  'rm -rf $X\nrm -rf $Y',
  'rm -rf $X # comment',
  'X=/ rm -rf $X',
  '(rm -rf $X)',
  'rm -rf {a,b}',
  'rm -rf `pwd`',
  'rm -rf $(rm -rf /)',
  'rm -rf $(curl x)',
  'rm -rf $(git clean -fdx)',
  'rm -rf "$(pwd)"/x',
  'rm -rf $(pwd)/dist',
  'rm -rf ${X:-/}',
  'rm -rf ${X}/../y',
  'rm -rf $X/../y',
  'rm -rf $1',
  "rm -rf $'\\x2f'",
  'rm -rf \\$X',
  'rm --no-preserve-root -rf /',
  'rm -rf $X --no-preserve-root',
  'rm -i $X',
  'rmdir -p $X',
  'rm -rf',
  'rm',
  'ls',
  '',
  // working-directory shapes that are not exactly the cwd
  'rm -rf ..',
  'rm -rf /Users/g/dolphin/workspaces',
  'rm -rf build',
  'rm -rf ./build',
  'rm -rf /',
  'rm -rf ~',
  'rm -rf ~/',
  'rm -rf /Users',
  'rm -rf ~other/repo',
  "rm -rf '$X'",
  // glob shapes
  'rm -rf *.log',
  'rm -rf /**',
  'rm -rf ~/**',
  'rm -rf ../**',
  'rm -rf "**"',
  // round 3: globs can match `..` (bash < 5.2) or follow symlinked folders
  'rm -rf .*/*',
  'rm -rf .?/*',
  'rm -rf */*',
  'rm -rf **/node_modules',
  'rm -rf src/**',
  'rm -rf */*/cache',
  'rm -rf build/[ab]',
  // round 3: system drives are not mounted drives
  'rm -rf /mnt/data',
  'rm -rf /media/g/usb',
  'rm -rf /volumes/Backup',
  // mounted-drive shapes
  'rm -rf /Volumes',
  'rm -rf /Volumes/Backup/old',
  'rm -rf /mnt/a/b'
]

const ACCEPTED: Row[] = [
  ['rm -rf .', ['working-directory']],
  ['rm -rf ./', ['working-directory']],
  ["rm -rf '.'", ['working-directory']],
  ['rm -rf /Users/g/dolphin/workspaces/repo', ['working-directory']],
  ['rm -rf /Users/g/dolphin/workspaces/repo/', ['working-directory']],
  ['rm -rf "/Users/g/dolphin/workspaces/repo"', ['working-directory']],
  ['rm -rf /users/G/dolphin/workspaces/REPO', ['working-directory']],
  ['rm -rf ~/dolphin/workspaces/repo', ['working-directory']],
  ['/bin/rm -rf .', ['working-directory']],
  ['rmdir .', ['working-directory']],
  ['rm -r -f -- .', ['working-directory']],
  ['rm --recursive --force --verbose .', ['working-directory']],
  ['rm -rf $BUILD', ['variable-target']],
  ['rm -rf ${BUILD}', ['variable-target']],
  ['rm -rf "$BUILD"', ['variable-target']],
  ['rm -rf "${BUILD}/out"', ['variable-target']],
  ['rm -rf $BUILD/out.tmp', ['variable-target']],
  ['rm -rf "$PWD"', ['variable-target']],
  ['rm -rf $(pwd)', ['command-substitution']],
  ['rm -rf "$(mktemp -d)"', ['command-substitution']],
  ['rm -rf $(git rev-parse --show-toplevel)', ['command-substitution']],
  ['rm -rf /Volumes/Backup', ['mounted-drive']],
  [
    'rm -rf $A $(pwd) . /Volumes/X',
    ['command-substitution', 'mounted-drive', 'variable-target', 'working-directory']
  ],
  ['rm -rf .', ['working-directory'], 'win32'],
  ["rm -rf 'C:\\Users\\g\\work\\repo'", ['working-directory'], 'win32'],
  ["rm -rf 'c:\\users\\g\\work\\REPO\\'", ['working-directory'], 'win32'],
  ['rm -rf C:/Users/g/work/repo', ['working-directory'], 'win32'],
  ['rm -rf /c/Users/g/work/repo', ['working-directory'], 'win32'],
  ['rm -rf /Volumes/Backup/', ['mounted-drive']],
  ['rm -rf /mnt/data', ['mounted-drive'], 'linux'],
  ['rm -rf /mnt/data/', ['mounted-drive'], 'linux'],
  ['rm -rf /media/g/usb', ['mounted-drive'], 'linux']
]

const PLATFORM_NULLS: Row[] = [
  ['rm -rf D:/', null, 'win32'],
  ['rm -rf /d/', null, 'win32'],
  ["rm -rf 'C:\\'", null, 'win32'],
  ['rm -rf /mnt/c', null, 'linux'],
  ['rm -rf /mnt/wsl', null, 'linux'],
  ['rm -rf /mnt/wslg', null, 'linux'],
  ['rm -rf /mnt/WSLg/', null, 'linux'],
  ['rm -rf /mnt/wsl-data', null, 'linux'],
  ['rm -rf /mnt/c/', null, 'linux'],
  ['rm -rf /media/usb', null, 'linux'],
  ['rm -rf /media/g/usb/x', null, 'linux'],
  ['rm -rf /Volumes/Backup', null, 'linux'],
  ['rm -rf /mnt/data', null, 'freebsd'],
  ['rm -rf /users/G/dolphin/workspaces/REPO', null, 'linux'],
  ['rm -rf /volumes/Backup', null, 'linux'],
  ['rm -rf ..', null, 'win32'],
  ['rm -rf C:/Users/g/work', null, 'win32'],
  ["rm -rf 'C:\\USERS\\G'", null, 'win32'],
  ['rm -rf "C:\\Users\\g\\work\\repo"', null, 'win32'],
  ['rm -rf /tmp/x', null, 'win32'],
  ['rm -rf C:relative', null, 'win32'],
  ['rm -rf D:', null, 'win32']
]

describe('classifyBypassRemovals', () => {
  it.each(REVIEW_PROBES)('review probe %j stays with the user', (command) => {
    expect(classify(command)).toBeNull()
  })

  it.each([...ACCEPTED, ...PLATFORM_NULLS])('%j → %j (%s)', (command, expected, platform) => {
    expect(classify(command, platform)).toEqual(expected)
  })

  it('needs the home dir to read ~/', () => {
    expect(
      classifyBypassRemovals('rm -rf ~/dolphin/workspaces/repo', CWD, { platform: 'darwin' })
    ).toBeNull()
  })

  it('refuses when the cwd itself is home or a parent of home', () => {
    expect(
      classifyBypassRemovals('rm -rf .', HOME, { homeDir: HOME, platform: 'darwin' })
    ).toBeNull()
    expect(
      classifyBypassRemovals('rm -rf .', '/Users', { homeDir: HOME, platform: 'darwin' })
    ).toBeNull()
  })
})

describe('analyzeBypassRemoval disk checks', () => {
  it('lists what main must confirm with realpath', () => {
    expect(
      analyzeBypassRemoval('rm -rf . /Volumes/X $Y', CWD, {
        homeDir: HOME,
        platform: 'darwin'
      })?.diskChecks
    ).toEqual([
      { kind: 'is-cwd', path: CWD },
      { kind: 'is-mount', path: '/Volumes/X' }
    ])
  })
})

describe('classifyBypassRemoval', () => {
  it('returns the single category, or null when there are several', () => {
    expect(classifyBypassRemoval('rm -rf $X', CWD)).toBe('variable-target')
    expect(classifyBypassRemoval('rm -rf $X $(pwd)', CWD)).toBeNull()
    expect(classifyBypassRemoval('ls', CWD)).toBeNull()
  })
})
