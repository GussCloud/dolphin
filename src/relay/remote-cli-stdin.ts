/** `design` subcommands whose `--file` holds JSON the host needs. */
export const DESIGN_FILE_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'canvas-set',
  'decide',
  'reply'
])

export function shouldReadRemoteCliStdin(argv: string[]): boolean {
  if (argv.includes('--help') || argv.includes('-h')) {
    return false
  }
  // Why: computer-use style flags (`--text-stdin`, ...) declare a stdin
  // payload directly in the flag name; the full-CLI bridge (#7716) must
  // forward stdin for them the same way local shells provide it.
  if (argv.some((part) => /^--[a-z0-9][a-z0-9-]*-stdin(?:=|$)/.test(part))) {
    return true
  }
  const commandPath = parseRemoteCliCommandPath(argv)
  const fileFlag = isLinearBodyWriteCommand(commandPath)
    ? 'body-file'
    : commandPath[0] === 'design' && DESIGN_FILE_SUBCOMMANDS.has(commandPath[1] ?? '')
      ? 'file'
      : null
  if (!fileFlag) {
    return false
  }
  return argv.some((part, index) => {
    if (part === `--${fileFlag}`) {
      return argv[index + 1] === '-'
    }
    return part === `--${fileFlag}=-`
  })
}

const REMOTE_STDIN_BOOLEAN_FLAGS = new Set(['current', 'help', 'json', 'parent-current'])

function parseRemoteCliCommandPath(argv: string[]): string[] {
  const commandPath: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      commandPath.push(token)
      continue
    }
    const assignment = token.slice(2)
    if (assignment.includes('=')) {
      continue
    }
    const next = argv[index + 1]
    if (!REMOTE_STDIN_BOOLEAN_FLAGS.has(assignment) && next && !next.startsWith('--')) {
      index += 1
    }
  }
  return commandPath
}

function isLinearBodyWriteCommand(commandPath: string[]): boolean {
  if (commandPath[0] !== 'linear') {
    return false
  }
  return (commandPath[1] === 'comment' && commandPath[2] === 'add') || commandPath[1] === 'create'
}
