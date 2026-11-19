import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { getRequiredStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'
import { resolveCoordinatorTerminalHandle } from './orchestration/terminal-identity'
import {
  latestDesignCanvas,
  type Design,
  type DesignDecision,
  type DesignInboxEntry,
  type DesignListEntry,
  type DesignMessage
} from '../../shared/design-types'

type DesignResult = { design: Design }

async function readProcessStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--file - reads the JSON from stdin, which is a TTY'
    )
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Canvas, decisions, replies, revisions and completions travel in a file, never argv: shells mangle JSON and argv length is bounded.
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

function formatInboxEntry(entry: DesignInboxEntry): string {
  const block = entry.block
    ? ` on block ${entry.block.id}${entry.block.title ? ` (${entry.block.title})` : ''}`
    : ''
  if (entry.kind === 'status') {
    return `${entry.id} status ${entry.status}: ${entry.text}`
  }
  if (entry.kind === 'comment') {
    return `${entry.id} comment ${entry.messageId}${block}: ${entry.text}`
  }
  const note = entry.note ? `\n  note: ${entry.note}` : ''
  return `${entry.id} answer to ${entry.decisionId}${block}: ${entry.question}\n  selected: ${entry.selected.join(', ')}${note}`
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

  'design decide': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const file = await readDesignCanvasFile(getRequiredStringFlag(flags, 'file'), cwd)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ decisions: DesignDecision[] }>('design.decide', {
      from,
      id,
      decisions: file
    })
    printResult(result, json, (r) =>
      r.decisions.map((d) => `Asked ${d.id}: ${d.question}`).join('\n')
    )
  },

  'design inbox': async ({ flags, client, cwd, json }) => {
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ items: DesignInboxEntry[]; ackCommand: string | null }>(
      'design.inbox',
      { from, id: getRequiredStringFlag(flags, 'id') }
    )
    printResult(result, json, (r) =>
      r.items.length === 0
        ? 'Inbox is empty.'
        : [...r.items.map(formatInboxEntry), '', `When done: ${r.ackCommand}`].join('\n')
    )
  },

  'design ack': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const items = getRequiredStringFlag(flags, 'items')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ acked: number }>('design.ack', { from, id, items })
    printResult(result, json, (r) => `Acked ${r.acked} item(s) on ${id}.`)
  },

  'design reply': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const reply = await readDesignCanvasFile(getRequiredStringFlag(flags, 'file'), cwd)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ message: DesignMessage }>('design.reply', {
      from,
      id,
      reply
    })
    printResult(result, json, (r) => `Reply ${r.message.id} posted on ${id}.`)
  },

  'design revise-decision': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const revision = await readDesignCanvasFile(getRequiredStringFlag(flags, 'file'), cwd)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<{ decision: DesignDecision }>('design.reviseDecision', {
      from,
      id,
      revision
    })
    printResult(result, json, (r) => `Decision ${r.decision.id} marked as updated on ${id}.`)
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

  'design complete': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const completion = await readDesignCanvasFile(getRequiredStringFlag(flags, 'file'), cwd)
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<DesignResult>('design.complete', { from, id, completion })
    printResult(
      result,
      json,
      (r) => `Design ${r.design.id} reported complete; the user confirms it or sends what is left.`
    )
  }
}
