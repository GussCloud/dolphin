import { Columns3, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentDashboardView } from './agent-dashboard-view-storage'

function ViewButton({
  view,
  current,
  label,
  icon,
  onChange
}: {
  view: AgentDashboardView
  current: AgentDashboardView
  label: string
  icon: React.ReactNode
  onChange: (view: AgentDashboardView) => void
}): React.JSX.Element {
  const selected = view === current
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={selected ? 'secondary' : 'ghost'}
          size="icon-xs"
          aria-label={label}
          aria-pressed={selected}
          onClick={() => onChange(view)}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Switches the agent dashboard between status columns and the lineage graph. */
export function AgentDashboardViewToggle({
  view,
  onChange
}: {
  view: AgentDashboardView
  onChange: (view: AgentDashboardView) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5">
      <ViewButton
        view="board"
        current={view}
        label={translate('dashboardPopout.view.board', 'Board view')}
        icon={<Columns3 className="size-3.5" />}
        onChange={onChange}
      />
      <ViewButton
        view="graph"
        current={view}
        label={translate('dashboardPopout.view.graph', 'Graph view')}
        icon={<Network className="size-3.5" />}
        onChange={onChange}
      />
    </div>
  )
}
