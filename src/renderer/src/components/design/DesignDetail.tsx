import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  SquareTerminal
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  isDesignDecisionOpen,
  latestDesignCanvas,
  type Design,
  type DesignBlock,
  type DesignStatus
} from '../../../../shared/design-types'
import {
  answerDesignDecision,
  commentOnDesign,
  resendDesignInbox,
  setDesignStatus,
  showDesign
} from './design-index'
import { isDesignAgentMissing, useDesignMinuteClock } from './design-agent-missing'
import { designBlockActivity } from './design-conversation'
import { runDesignMutation } from './design-mutation'
import {
  DesignCanvasInteractionContext,
  type DesignCanvasInteraction
} from './design-canvas-interaction'
import { DesignAgentMissingActions, DesignAgentMissingBadge } from './DesignAgentMissing'
import { DesignSidePanel, type DesignSidePanelTab } from './DesignSidePanel'
import { DesignThread } from './DesignThread'
import { designStatusActions } from './design-status-actions'
import { DesignStatusBadge } from './DesignStatusBadge'
import { designAgentLabel, formatDesignTimestamp } from './design-format'

const DesignCanvas = lazy(() => import('./DesignCanvas'))

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; design: Design }
  | { kind: 'error'; message: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function CanvasPlaceholder({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function DesignDetail({
  id,
  listUpdatedAt,
  onBack
}: {
  id: string
  /** The list row's updatedAt; a change means the host has a newer design to show. */
  listUpdatedAt: number | null
  onBack: () => void
}): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [pendingStatus, setPendingStatus] = useState<DesignStatus | null>(null)
  const environmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelTab, setPanelTab] = useState<DesignSidePanelTab>('decisions')
  const [openBlockId, setOpenBlockId] = useState<string | null>(null)
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)
  const now = useDesignMinuteClock()

  useEffect(() => {
    let cancelled = false
    showDesign(id).then(
      (design) => !cancelled && setState({ kind: 'ready', design }),
      (error: unknown) => !cancelled && setState({ kind: 'error', message: errorMessage(error) })
    )
    return () => {
      cancelled = true
    }
  }, [id, listUpdatedAt])

  const design = state.kind === 'ready' ? state.design : null
  const canvas = design ? latestDesignCanvas(design) : null

  // Why: a failed mutation toasts and rethrows so the composer keeps the user's text.
  const mutate = useCallback(
    async (run: () => Promise<void>): Promise<void> => {
      const next = await runDesignMutation({
        mutate: run,
        reload: () => showDesign(id),
        onError: (error) => toast.error(errorMessage(error))
      })
      if (next) {
        setState({ kind: 'ready', design: next })
      }
    },
    [id]
  )
  const answer = useCallback(
    (input: { decisionId: string; selected: string[]; note?: string }) =>
      mutate(() => answerDesignDecision({ id, ...input })),
    [id, mutate]
  )
  const comment = useCallback(
    (input: { blockId?: string; text: string }) => mutate(() => commentOnDesign({ id, ...input })),
    [id, mutate]
  )
  const resend = useCallback(
    () => mutate(() => resendDesignInbox(id)).catch(() => {}),
    [id, mutate]
  )

  const messages = design?.messages
  const activitySource = useMemo(
    () => (design ? { decisions: design.decisions, messages: design.messages } : null),
    [design]
  )
  const interaction = useMemo((): DesignCanvasInteraction => {
    const activity = activitySource ? designBlockActivity(activitySource) : new Map()
    return {
      activity,
      highlightedBlockId,
      openBlockId,
      setOpenBlockId,
      renderBlockThread: (block: DesignBlock) => (
        <DesignThread
          messages={messages ?? []}
          blockId={block.id}
          autoFocus
          placeholder={translate(
            'auto.components.design.thread.blockPlaceholder',
            'Ask or request a change to this block'
          )}
          onSend={(text) => comment({ blockId: block.id, text })}
        />
      )
    }
  }, [activitySource, comment, highlightedBlockId, messages, openBlockId])
  const openDecisionCount = design?.decisions.filter(isDesignDecisionOpen).length ?? 0

  const moveTo = async (status: DesignStatus): Promise<void> => {
    setPendingStatus(status)
    try {
      await setDesignStatus(id, status)
      setState({ kind: 'ready', design: await showDesign(id) })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPendingStatus(null)
    }
  }

  const openWorktree = (worktreeId: string): void => {
    const opened = activateAndRevealWorktree(
      worktreeId,
      environmentId ? { executionHostId: toRuntimeExecutionHostId(environmentId) } : {}
    )
    if (opened === false) {
      toast.error(
        translate(
          'auto.components.design.detail.worktreeMissing',
          'The workspace for this design is no longer available.'
        )
      )
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {translate('auto.components.design.detail.back', 'All designs')}
        </Button>
        {design ? (
          <>
            <h2 className="min-w-0 truncate text-sm font-semibold">{design.name}</h2>
            <DesignStatusBadge status={design.status} />
            {isDesignAgentMissing(design, now) ? <DesignAgentMissingBadge /> : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {design.worktreeId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => design.worktreeId && openWorktree(design.worktreeId)}
                >
                  <SquareTerminal className="size-4" />
                  {translate('auto.components.design.detail.openWorktree', 'Open workspace')}
                </Button>
              ) : null}
              {designStatusActions(design.status).map((action) => (
                <Button
                  key={action.to}
                  type="button"
                  size="sm"
                  variant={action.variant}
                  disabled={pendingStatus !== null}
                  onClick={() => void moveTo(action.to)}
                >
                  {pendingStatus === action.to ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  {action.label}
                </Button>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-pressed={panelOpen}
                    aria-label={translate(
                      'auto.components.design.panel.toggle',
                      'Decisions and activity'
                    )}
                    onClick={() => setPanelOpen((value) => !value)}
                  >
                    {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {translate('auto.components.design.panel.toggle', 'Decisions and activity')}
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {translate('auto.components.design.detail.loading', 'Loading design…')}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {translate('auto.components.design.detail.error', 'Could not load this design')}
            </p>
            <pre className="whitespace-pre-wrap font-mono text-xs opacity-80">{state.message}</pre>
          </div>
        </div>
      ) : null}

      {design ? (
        <>
          <div className="shrink-0 space-y-1 text-xs text-muted-foreground">
            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-foreground">
              {canvas?.canvas.summary ?? design.request}
            </p>
            <p>
              {[
                designAgentLabel(design.agent),
                canvas
                  ? translate('auto.components.design.detail.version', 'Version {{value0}}', {
                      value0: canvas.version
                    })
                  : null,
                translate('auto.components.design.list.updated', 'Updated {{value0}}', {
                  value0: formatDesignTimestamp(design.updatedAt)
                })
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {isDesignAgentMissing(design, now) ? (
            <div className="shrink-0 rounded-xl border border-status-warning-border bg-status-warning-background px-3 py-2">
              <DesignAgentMissingActions
                design={design}
                withExplanation
                onDiscarded={() =>
                  void showDesign(id).then((next) => setState({ kind: 'ready', design: next }))
                }
              />
            </div>
          ) : null}
          {!panelOpen && openDecisionCount > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="w-fit shrink-0"
              onClick={() => {
                setPanelTab('decisions')
                setPanelOpen(true)
              }}
            >
              {translate(
                'auto.components.design.panel.openDecisions',
                '{{value0}} decisions waiting for you',
                {
                  value0: openDecisionCount
                }
              )}
            </Button>
          ) : null}
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
              {canvas ? (
                <Suspense
                  fallback={
                    <CanvasPlaceholder>
                      <LoaderCircle className="size-4 animate-spin" />
                    </CanvasPlaceholder>
                  }
                >
                  <DesignCanvasInteractionContext.Provider value={interaction}>
                    <DesignCanvas canvas={canvas.canvas} version={canvas.version} />
                  </DesignCanvasInteractionContext.Provider>
                </Suspense>
              ) : (
                <CanvasPlaceholder>
                  <PenTool className="size-4" />
                  {translate(
                    'auto.components.design.detail.noCanvas',
                    'The agent has not drawn this design yet.'
                  )}
                </CanvasPlaceholder>
              )}
            </div>
            {panelOpen ? (
              <DesignSidePanel
                design={design}
                tab={panelTab}
                onTabChange={setPanelTab}
                onAnswer={answer}
                onComment={comment}
                onResend={resend}
                onHoverBlock={setHighlightedBlockId}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
