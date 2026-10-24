import { Goal, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AutonomousGoalStatus } from '../../../../shared/autonomous-goal-types'
import { useWorktreeAutonomousGoal } from './use-worktree-autonomous-goal'

function statusLabel(status: AutonomousGoalStatus): string {
  switch (status) {
    case 'blocked':
      return translate('auto.components.AutonomousGoalStrip.blocked', 'Needs your decision')
    case 'usageLimited':
      return translate('auto.components.AutonomousGoalStrip.usageLimited', 'Paused on plan usage')
    case 'active':
    case 'complete':
    case 'stopped':
      return translate('auto.components.AutonomousGoalStrip.active', 'Working')
  }
}

/** One line above the workspace while its coordinator drives an autonomous goal. */
export function AutonomousGoalStrip({
  worktreeId
}: {
  worktreeId: string | null
}): React.JSX.Element | null {
  const { goal, stop } = useWorktreeAutonomousGoal(worktreeId)
  if (!goal) {
    return null
  }
  const blocker = goal.notes.findLast((note) => note.kind === 'blocker')?.text
  const stopLabel = translate('auto.components.AutonomousGoalStrip.stop', 'Stop goal')
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 py-1 pr-1 pl-3 text-xs text-muted-foreground"
      data-autonomous-goal-status={goal.status}
    >
      <Goal aria-hidden className="size-3.5 shrink-0" />
      <span className="shrink-0 font-medium text-foreground">{statusLabel(goal.status)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate">{blocker ?? goal.objective}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="max-w-md whitespace-pre-wrap">
          {goal.objective}
        </TooltipContent>
      </Tooltip>
      <span className="shrink-0 tabular-nums">
        {translate('auto.components.AutonomousGoalStrip.rotations', 'Rotations: {{value}}', {
          value: goal.rotations
        })}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={stopLabel}
            onClick={() => {
              void stop(goal.id).catch(() =>
                toast.error(
                  translate(
                    'auto.components.AutonomousGoalStrip.stopFailed',
                    'Could not stop the goal.'
                  )
                )
              )
            }}
          >
            <Square />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {stopLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
