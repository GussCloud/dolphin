// `design.*` — the renderer creates a design, then its agent binds to it and writes the canvas from
// its own terminal, so the host that runs the agent owns the design.
import type { z } from 'zod'
import {
  buildDesignAgentInstructions,
  buildDesignLaunchPrompt
} from '../../../../shared/design-agent-prompt'
import {
  canTransitionDesign,
  DESIGN_STATUS_TRANSITIONS,
  latestDesignCanvas,
  type Design,
  type DesignAgentStatus,
  type DesignCanvas,
  type DesignListEntry
} from '../../../../shared/design-types'
import {
  DesignAgentStatusParams,
  DesignCanvasSchema,
  DesignCanvasSetParams,
  DesignCreateParams,
  DesignListParams,
  DesignRenameParams,
  DesignSetStatusParams,
  DesignShowParams,
  DesignStartParams
} from '../../../../shared/rpc-contract/design-params'
import { getDesignStore } from '../../../designs/design-store-instance'
import { toDesignListEntry } from '../../../designs/design-store'
import { OrchestrationError } from '../../orchestration/orchestration-error'
import { defineMethod, type RpcContext } from '../core'
import { resolveOrchestrationCaller } from './orchestration/runs/run-scope'

function callerPane(
  from: string,
  context: Pick<
    RpcContext,
    'orchestrationCompatibilityEvidence' | 'orchestrationCaller' | 'runtime'
  >
): { paneKey: string; terminalHandle: string | null } {
  const caller = resolveOrchestrationCaller(context.runtime, {
    callerTerminalHandle: from,
    callerEvidence: context.orchestrationCompatibilityEvidence,
    callerSession: context.orchestrationCaller,
    requireStablePane: true
  })
  if (caller.paneKey === null) {
    throw new OrchestrationError(
      'design_requires_terminal_pane',
      'A design must be drawn from a Dolphin agent terminal.'
    )
  }
  return { paneKey: caller.paneKey, terminalHandle: caller.terminalHandle }
}

export function requireDesign(id: string): Design {
  const design = getDesignStore().get(id)
  if (!design) {
    throw new OrchestrationError('design_not_found', `Design ${id} was not found.`)
  }
  return design
}

/** Only the pane `design.start` bound may act as the design's agent. */
export function requireBoundDesign(id: string, from: string, context: RpcContext): Design {
  const design = requireDesign(id)
  if (design.paneKey === null || design.paneKey !== callerPane(from, context).paneKey) {
    throw new OrchestrationError(
      'design_not_bound_to_caller',
      `This terminal is not bound to design ${id}. Run \`dolphin design start --id ${id}\` first.`
    )
  }
  return design
}

async function terminalWorktreeId(
  runtime: RpcContext['runtime'],
  handle: string | null
): Promise<string | null> {
  if (!handle) {
    return null
  }
  try {
    return (await runtime.showTerminal(handle)).worktreeId ?? null
  } catch {
    return null
  }
}

const FILE_ISSUES_SHOWN = 5

/** Path-qualified issues, so the agent can fix the exact element and retry. */
export function parseDesignFile<T>(
  schema: z.ZodType<T>,
  value: unknown,
  code: string,
  label: string
): T {
  const parsed = schema.safeParse(value)
  if (parsed.success) {
    return parsed.data
  }
  const issues = parsed.error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message
  )
  const more =
    issues.length > FILE_ISSUES_SHOWN ? ` (+${issues.length - FILE_ISSUES_SHOWN} more)` : ''
  throw new OrchestrationError(
    code,
    `${label} refused: ${issues.slice(0, FILE_ISSUES_SHOWN).join('; ')}${more}`
  )
}

function parseCanvas(canvas: unknown): DesignCanvas {
  return parseDesignFile(DesignCanvasSchema, canvas, 'design_invalid_canvas', 'Canvas')
}

function refuseTransition(design: Design, to: Design['status']): never {
  const allowed = DESIGN_STATUS_TRANSITIONS[design.status]
  throw new OrchestrationError(
    'design_invalid_transition',
    `Design ${design.id} cannot move from ${design.status} to ${to}; allowed: ${allowed.join(', ') || 'none'}.`
  )
}

export const DESIGN_METHODS = [
  defineMethod({
    name: 'design.create',
    params: DesignCreateParams,
    handler: (params) => {
      const design = getDesignStore().create({
        name: params.name,
        request: params.request,
        agent: params.agent,
        repoId: params.repoId ?? null
      })
      return { design, launchPrompt: buildDesignLaunchPrompt(design.id) }
    }
  }),
  defineMethod({
    name: 'design.start',
    params: DesignStartParams,
    handler: async (params, context) => {
      const design = requireDesign(params.id)
      if (design.status === 'discarded') {
        throw new OrchestrationError(
          'design_discarded',
          `Design ${design.id} was discarded; restore it before drawing.`
        )
      }
      const caller = callerPane(params.from, context)
      // Why rebinding is allowed: a restarted agent gets a new pane; the event log records it.
      // Why any pane may claim it (phase 1): the id is only handed to the agent the user launched.
      // Why no status change: planning stays a draft until the user approves the design.
      const bound = getDesignStore().bindAgent(design.id, {
        paneKey: caller.paneKey,
        worktreeId: await terminalWorktreeId(context.runtime, caller.terminalHandle)
      })
      return {
        design: bound,
        instructions: buildDesignAgentInstructions(bound, latestDesignCanvas(bound)?.version)
      }
    }
  }),
  defineMethod({
    name: 'design.canvasSet',
    params: DesignCanvasSetParams,
    handler: (params, context) => {
      const design = requireBoundDesign(params.id, params.from, context)
      return { version: getDesignStore().setCanvas(design.id, parseCanvas(params.canvas)).version }
    }
  }),
  defineMethod({
    name: 'design.show',
    params: DesignShowParams,
    handler: (params) => ({ design: requireDesign(params.id) })
  }),
  defineMethod({
    name: 'design.agentStatus',
    params: DesignAgentStatusParams,
    handler: async (params, context): Promise<DesignAgentStatus> => {
      const { paneKey } = requireDesign(params.id)
      // Why the same reads as the inbox watchdog: the indicator must agree with when nudges are typed.
      const handle = paneKey ? context.runtime.getLiveTerminalHandleForPaneKey(paneKey) : null
      if (!handle) {
        return { live: false, status: null }
      }
      try {
        return { live: true, status: (await context.runtime.getTerminalAgentStatus(handle)).status }
      } catch {
        // Why not live=false: a failed read is not evidence the pane exited.
        return { live: true, status: null }
      }
    }
  }),
  defineMethod({
    name: 'design.list',
    params: DesignListParams,
    handler: (): { designs: DesignListEntry[] } => ({
      designs: getDesignStore()
        .list()
        .toSorted((a, b) => b.updatedAt - a.updatedAt)
        .map(toDesignListEntry)
    })
  }),
  defineMethod({
    name: 'design.setStatus',
    params: DesignSetStatusParams,
    handler: (params) => {
      if (params.from) {
        throw new OrchestrationError(
          'design_status_user_only',
          `Only the user moves design ${params.id}. When the approved design is implemented, run \`dolphin design complete --id ${params.id} --file <path>\`; the user confirms it.`
        )
      }
      const design = requireDesign(params.id)
      if (!canTransitionDesign(design.status, params.status)) {
        refuseTransition(design, params.status)
      }
      return { design: getDesignStore().setStatus(design.id, params.status) }
    }
  }),
  defineMethod({
    name: 'design.rename',
    params: DesignRenameParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      return { design: getDesignStore().rename(design.id, params.name) }
    }
  })
]
