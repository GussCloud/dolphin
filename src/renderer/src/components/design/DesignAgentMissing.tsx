import { useState } from 'react'
import { LoaderCircle, RotateCw, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { DesignListEntry } from '../../../../shared/design-types'
import { setDesignStatus } from './design-index'
import { designRetryPrefill } from './design-agent-retry'
import { useDesignHostActions } from './design-host-actions'

function explanation(): string {
  return translate(
    'auto.components.design.agentMissing.explain',
    'No agent terminal has connected to this design since it was created. The launch likely failed, so nothing is drawing it.'
  )
}

export function DesignAgentMissingBadge(): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-design-agent-missing=""
          className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-background px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap text-status-warning"
        >
          <Unplug className="size-3" />
          {translate('auto.components.design.agentMissing.badge', 'No agent')}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-xs">
        {explanation()}
      </TooltipContent>
    </Tooltip>
  )
}

/** Discard or retry for a design whose agent never started. */
export function DesignAgentMissingActions({
  design,
  onDiscarded,
  withExplanation = false
}: {
  design: Pick<DesignListEntry, 'id' | 'name' | 'request' | 'repoId'>
  onDiscarded?: () => void
  withExplanation?: boolean
}): React.JSX.Element {
  const [discarding, setDiscarding] = useState(false)
  const { openComposer } = useDesignHostActions()
  const discard = async (): Promise<void> => {
    setDiscarding(true)
    try {
      await setDesignStatus(design.id, 'discarded')
      onDiscarded?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setDiscarding(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {withExplanation ? (
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{explanation()}</p>
      ) : null}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={discarding}
        onClick={() => void discard()}
      >
        {discarding ? <LoaderCircle className="size-3 animate-spin" /> : null}
        {translate('auto.components.design.action.discard', 'Discard')}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => openComposer(designRetryPrefill(design))}
      >
        <RotateCw className="size-3" />
        {translate('auto.components.design.agentMissing.retry', 'Try again')}
      </Button>
    </div>
  )
}
