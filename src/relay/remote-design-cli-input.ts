import { resolve } from 'node:path'
import { readArtifactFileWithinLimit } from '../shared/artifact-file-read'
import { DISPATCHER_CONTROL_QUEUE_MAX_BYTES } from './dispatcher-writer-admission'
import { remoteArtifactCliForwardingFrameBytes } from './remote-artifact-cli-forwarding'
import { DESIGN_FILE_SUBCOMMANDS } from './remote-cli-stdin'

export type PreparedRemoteDesignCliInput = { argv: string[]; stdin: string }

// Why headroom: the frame also carries argv, cwd and env next to the file.
const DESIGN_CANVAS_FILE_MAX_BYTES = DISPATCHER_CONTROL_QUEUE_MAX_BYTES - 64 * 1024

/** Index of the `--file` value token (or the `--file=` token itself) in a `design` file command. */
function findCanvasFileArg(argv: string[]): { index: number; inline: boolean } | null {
  const positionals: string[] = []
  let found: { index: number; inline: boolean } | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    if (token.startsWith('--file=')) {
      found = { index, inline: true }
      continue
    }
    if (token === '--file' && argv[index + 1] !== undefined) {
      found = { index: index + 1, inline: false }
      index += 1
      continue
    }
    if (token !== '--json' && token !== '--help' && argv[index + 1]?.startsWith('--') === false) {
      index += 1
    }
  }
  return positionals[0] === 'design' && DESIGN_FILE_SUBCOMMANDS.has(positionals[1] ?? '')
    ? found
    : null
}

/**
 * The bridged CLI runs on the Dolphin client, which cannot open a path on this SSH host, so the
 * relay reads the file here and forwards it as stdin with `--file -`, like `artifacts share`.
 * Mixed versions: an older relay forwards the path unchanged and the client fails with "Cannot read --file".
 */
export async function prepareRemoteDesignCliInput(
  argv: string[],
  cwd: string
): Promise<PreparedRemoteDesignCliInput | null> {
  if (argv.includes('--help')) {
    return null
  }
  const fileArg = findCanvasFileArg(argv)
  if (!fileArg) {
    return null
  }
  const token = argv[fileArg.index]
  const file = fileArg.inline ? token.slice('--file='.length) : token
  if (file === '-' || file === '') {
    return null
  }
  const path = resolve(cwd, file)
  const result = await readArtifactFileWithinLimit(path, DESIGN_CANVAS_FILE_MAX_BYTES)
  if (result.status === 'not-file') {
    throw new Error(`Cannot read --file ${path}: not found or not a file.`)
  }
  if (result.status === 'too-large') {
    throw new Error(`--file ${path} is too large for the Dolphin SSH transport.`)
  }
  const rewritten = [...argv]
  rewritten[fileArg.index] = fileArg.inline ? '--file=-' : '-'
  const prepared = { argv: rewritten, stdin: result.status === 'ok' ? result.content : '' }
  if (
    remoteArtifactCliForwardingFrameBytes({ ...prepared, cwd, env: {} }) >
    DISPATCHER_CONTROL_QUEUE_MAX_BYTES
  ) {
    throw new Error(`--file ${path} is too large for the Dolphin SSH transport.`)
  }
  return prepared
}
