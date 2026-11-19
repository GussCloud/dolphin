import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, LoaderCircle, PenTool, SquareTerminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import { latestDesignCanvas, type Design, type DesignStatus } from '../../../../shared/design-types'
import { setDesignStatus, showDesign } from './design-index'
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
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
            {canvas ? (
              <Suspense
                fallback={
                  <CanvasPlaceholder>
                    <LoaderCircle className="size-4 animate-spin" />
                  </CanvasPlaceholder>
                }
              >
                <DesignCanvas canvas={canvas.canvas} />
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
        </>
      ) : null}
    </div>
  )
}
