import { ChevronRight, PenTool } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { useRepoMap } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { DesignListEntry } from '../../../../shared/design-types'
import { DesignStatusBadge } from './DesignStatusBadge'
import { designAgentLabel, formatDesignTimestamp } from './design-format'

export function DesignList({
  designs,
  onOpen
}: {
  designs: readonly DesignListEntry[]
  onOpen: (id: string) => void
}): React.JSX.Element {
  const repoMap = useRepoMap()
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {designs.map((design) => {
        const repoName = design.repoId
          ? (repoMap.get(design.repoId)?.displayName ?? design.repoId)
          : null
        return (
          <li key={design.id}>
            <button
              type="button"
              onClick={() => onOpen(design.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <PenTool className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{design.name}</span>
                  <DesignStatusBadge status={design.status} />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <AgentIcon agent={isTuiAgent(design.agent) ? design.agent : null} size={12} />
                    {designAgentLabel(design.agent)}
                  </span>
                  {repoName ? <span className="truncate">{repoName}</span> : null}
                  <span>
                    {design.groupCount > 0
                      ? translate('auto.components.design.list.groups', '{{value0}} steps', {
                          value0: design.groupCount
                        })
                      : translate('auto.components.design.list.noCanvas', 'No canvas yet')}
                  </span>
                  <span>
                    {translate('auto.components.design.list.updated', 'Updated {{value0}}', {
                      value0: formatDesignTimestamp(design.updatedAt)
                    })}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
