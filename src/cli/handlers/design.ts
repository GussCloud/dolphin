import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { getRequiredStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'
import { resolveCoordinatorTerminalHandle } from './orchestration/terminal-identity'
import { latestDesignCanvas, type Design, type DesignListEntry } from '../../shared/design-types'

type DesignResult = { design: Design }

async function readProcessStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--file - reads the canvas from stdin, which is a TTY'
    )
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * The canvas travels in a file, never argv: shells mangle JSON and argv length is bounded.
 * `-` reads stdin, which is how the SSH relay forwards a file it read on the remote host.
 */
export async function readDesignCanvasFile(
  file: string,
  cwd: string,
  readStdin: () => Promise<string> = readProcessStdin
): Promise<unknown> {
  const path = file === '-' ? 'stdin' : resolve(cwd, file)
  let text: string
  try {
    text = file === '-' ? await readStdin() : await readFile(path, 'utf-8')
  } catch (error) {
    if (error instanceof RuntimeClientError) {
      throw error
    }
    const reason = error instanceof Error ? error.message : String(error)
    throw new RuntimeClientError('invalid_argument', `Cannot read --file ${path}: ${reason}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new RuntimeClientError('invalid_argument', `--file ${path} is not valid JSON: ${reason}`)
  }
}

function formatDesign(design: Design): string {
  const latest = latestDesignCanvas(design)
  return [
    `${design.id} [${design.status}] ${design.name}`,
    `agent ${design.agent}, canvas ${latest ? `v${latest.version} (${latest.canvas.groups.length} groups)` : 'none'}`,
    design.request
  ].join('\n')
}

export const DESIGN_HANDLERS: Record<string, CommandHandler> = {
  'design start': async ({ flags, client, cwd, json }) => {
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<DesignResult & { instructions: string }>('design.start', {
      from,
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, (r) => [formatDesign(r.design), '', r.instructions].join('\n'))
  },

  'design canvas-set': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const canvas = await readDesignCanvasFile(getRequiredStringFlag(flags, 'file'), cwd)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ version: number }>('design.canvasSet', { from, id, canvas })
    printResult(result, json, (r) => `Canvas v${r.version} saved for ${id}.`)
  },

  'design show': async ({ flags, client, json }) => {
    const result = await client.call<DesignResult>('design.show', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, (r) => formatDesign(r.design))
  },

  'design list': async ({ client, json }) => {
    const result = await client.call<{ designs: DesignListEntry[] }>('design.list', {})
    printResult(result, json, (r) =>
      r.designs.length === 0
        ? 'No designs.'
        : r.designs.map((d) => `${d.id} [${d.status}] ${d.name}`).join('\n')
    )
  },

  'design status': async ({ flags, client, cwd, json }) => {
    // Why only with --from: without it the move is the user's, and needs no terminal identity.
    const from = flags.has('from')
      ? await resolveCoordinatorTerminalHandle(flags, cwd, client)
      : undefined
    const result = await client.call<DesignResult>('design.setStatus', {
      id: getRequiredStringFlag(flags, 'id'),
      status: getRequiredStringFlag(flags, 'status'),
      ...(from ? { from } : {})
    })
    printResult(result, json, (r) => `Design ${r.design.id} is ${r.design.status}.`)
  }
}
