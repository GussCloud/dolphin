import { Goal, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AutonomousGoalStatus } from '../../../../shared/autonomous-goal-types'
import {
  stopAutonomousGoal,
  useAutonomousGoalWorkerTask,
  useCoordinatedAutonomousGoal
} from '@/components/autonomous-goal/autonomous-goal-index'

function goalStatusLabel(status: AutonomousGoalStatus): string {
  switch (status) {
    case 'blocked':
      return translate('auto.components.WorktreeCardAutonomousGoal.blocked', 'Needs your decision')
    case 'usageLimited':
      return translate('auto.components.WorktreeCardAutonomousGoal.usageLimited', 'Paused')
    case 'active':
    case 'complete':
    case 'stopped':
      return translate('auto.components.WorktreeCardAutonomousGoal.active', 'Working')
  }
}

/** Marks the worktree whose agent coordinates an open autonomous goal. */
export function WorktreeCardGoalBadge({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const goal = useCoordinatedAutonomousGoal(worktreeId)
  if (!goal) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="h-[16px] px-1.5 text-[10px] font-medium rounded shrink-0 leading-none text-foreground/70 border-foreground/20 bg-foreground/[0.06]"
        >
          <Goal aria-hidden className="size-2.5" />
          {translate('auto.components.WorktreeCardAutonomousGoal.badge', 'goal')}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-72 whitespace-pre-wrap">
        {goal.objective}
      </TooltipContent>
    </Tooltip>
  )
}

/** The coordinator's goal progress, or a worker's Task, under the card title. */
export function WorktreeCardGoalRow({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const goal = useCoordinatedAutonomousGoal(worktreeId)
  const workerTask = useAutonomousGoalWorkerTask(worktreeId)
  if (goal) {
    const total = goal.progress?.tasksTotal ?? 0
    const completed = goal.progress?.tasksCompleted ?? 0
    const stopLabel = translate('auto.components.WorktreeCardAutonomousGoal.stop', 'Stop goal')
    return (
      <div
        className="flex min-w-0 flex-col gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground"
        data-worktree-card-goal-status={goal.status}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-medium text-foreground">
            {goalStatusLabel(goal.status)}
          </span>
          {goal.progress ? (
            <span className="truncate tabular-nums">
              {translate(
                'auto.components.WorktreeCardAutonomousGoal.tasks',
                '{{completed}} of {{total}} tasks',
                { completed, total }
              )}
            </span>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                aria-label={stopLabel}
                onClick={(event) => {
                  event.stopPropagation()
                  void stopAutonomousGoal(goal.id).catch(() =>
                    toast.error(
                      translate(
                        'auto.components.WorktreeCardAutonomousGoal.stopFailed',
                        'Could not stop the goal.'
                      )
                    )
                  )
                }}
              >
                <Square />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {stopLabel}
            </TooltipContent>
          </Tooltip>
        </div>
        {total > 0 ? (
          <Progress
            value={Math.round((completed / total) * 100)}
            aria-label={translate(
              'auto.components.WorktreeCardAutonomousGoal.progress',
              'Goal progress'
            )}
          />
        ) : null}
        <span className="truncate tabular-nums">
          {translate(
            'auto.components.WorktreeCardAutonomousGoal.rotations',
            'Rotations: {{value}}',
            { value: goal.rotations }
          )}
        </span>
      </div>
    )
  }
  if (workerTask) {
    return (
      <span className="truncate text-xs text-muted-foreground">
        {translate('auto.components.WorktreeCardAutonomousGoal.workerTask', 'Task {{ordinal}}', {
          ordinal: workerTask.taskOrdinal
        })}
      </span>
    )
  }
  return null
}
