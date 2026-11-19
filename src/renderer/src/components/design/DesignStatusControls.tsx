import { useState } from 'react'
import { LoaderCircle, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import {
  isDesignDecisionOpen,
  latestDesignCanvas,
  type Design,
  type DesignStatus
} from '../../../../shared/design-types'
import { setDesignStatus } from './design-index'
import { designStatusActions, type DesignStatusAction } from './design-status-actions'
import { designStatusConfirmOptions } from './design-status-confirm'

/** The user's status moves for a design: primary buttons, fallbacks in a menu, confirms first. */
export function DesignStatusControls({
  design,
  onMoved
}: {
  design: Design
  onMoved: () => Promise<void>
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const [pendingStatus, setPendingStatus] = useState<DesignStatus | null>(null)
  const actions = designStatusActions(design.status, {
    agentBound: design.paneKey !== null,
    hasCanvas: latestDesignCanvas(design) !== null
  })
  const primary = actions.filter((action) => action.placement === 'primary')
  const overflow = actions.filter((action) => action.placement === 'overflow')

  const run = async (action: DesignStatusAction): Promise<void> => {
    if (action.confirm !== null) {
      const confirmed = await confirm(
        designStatusConfirmOptions(action.confirm, {
          canvasVersion: latestDesignCanvas(design)?.version ?? null,
          openDecisionCount: design.decisions.filter(isDesignDecisionOpen).length
        })
      )
      if (!confirmed) {
        return
      }
    }
    setPendingStatus(action.to)
    try {
      await setDesignStatus(design.id, action.to)
      await onMoved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingStatus(null)
    }
  }

  return (
    <>
      {primary.map((action) => {
        const button = (
          <Button
            key={action.to}
            type="button"
            size="sm"
            variant={action.variant}
            data-design-status-action={action.to}
            disabled={pendingStatus !== null || action.disabledReason !== null}
            onClick={() => void run(action)}
          >
            {pendingStatus === action.to ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {action.label}
          </Button>
        )
        if (action.disabledReason === null) {
          return button
        }
        // Why: a disabled button gets no hover events, so the tooltip hangs on a focusable wrapper.
        return (
          <Tooltip key={action.to}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {action.disabledReason}
            </TooltipContent>
          </Tooltip>
        )
      })}
      {overflow.length > 0 ? (
        // Why: non-modal so the confirmation dialog opened from an item can take focus.
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={pendingStatus !== null}
              aria-label={translate('auto.components.design.action.more', 'More actions')}
            >
              {pendingStatus !== null && overflow.some((action) => action.to === pendingStatus) ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <MoreHorizontal />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((action) => (
              <DropdownMenuItem
                key={action.to}
                data-design-status-action={action.to}
                onSelect={() => void run(action)}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}
