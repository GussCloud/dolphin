import React from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { translate } from '@/i18n/i18n'
import { isAutonomousGoalAgent } from '../../../../shared/autonomous-goal-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  DEFAULT_ORCHESTRATION_AGENT,
  MAX_ORCHESTRATION_AGENTS,
  listOrchestrationAgents,
  normalizeOrchestrationAgents,
  type OrchestrationAgentProfile
} from '../../../../shared/orchestration-agent-profiles'
import { SettingsSubsectionHeader } from './SettingsFormControls'
import { OrchestrationAgentEditor } from './OrchestrationAgentEditor'

function newAgentId(): string {
  return `orchestration-agent-${createBrowserUuid().slice(0, 8)}`
}

function agentSummary(agent: OrchestrationAgentProfile): string {
  return translate(
    'auto.components.settings.OrchestrationAgents.summary',
    '{{coordinator}} · workers {{worker}} · {{count}} in parallel',
    {
      coordinator: agent.coordinatorAgent,
      worker: agent.workerAgent,
      count: agent.maxConcurrent
    }
  )
}

/** The agents the composer's Orchestration mode offers: Dolphin's, read-only, then the user's. */
export function OrchestrationAgentsSection({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}): React.JSX.Element {
  const custom = normalizeOrchestrationAgents(settings.orchestrationAgents)
  const agents = listOrchestrationAgents(custom)
  const [selectedId, setSelectedId] = React.useState(DEFAULT_ORCHESTRATION_AGENT.id)
  const selected = agents.find((agent) => agent.id === selectedId) ?? DEFAULT_ORCHESTRATION_AGENT
  const goalAgents = React.useMemo(
    () => getAgentCatalog().filter((entry) => isAutonomousGoalAgent(entry.id)),
    []
  )
  const save = (next: OrchestrationAgentProfile[]): void => {
    void updateSettings({ orchestrationAgents: next })
  }
  const addFrom = (source: OrchestrationAgentProfile, name: string): void => {
    const agent = { ...source, id: newAgentId(), name }
    save([...custom, agent])
    setSelectedId(agent.id)
  }
  const canAdd = custom.length < MAX_ORCHESTRATION_AGENTS

  return (
    <section className="space-y-3" data-settings-orchestration-agents>
      <SettingsSubsectionHeader
        title={translate(
          'auto.components.settings.OrchestrationAgents.title',
          'Orchestration agents'
        )}
        description={translate(
          'auto.components.settings.OrchestrationAgents.sectionDescription',
          'Offered by the Orchestration mode of a new worktree. Each one presets the coordinator, its workers and their parallelism, and adds a strategy on top of Dolphin rules.'
        )}
        action={
          <Button
            type="button"
            size="sm"
            disabled={!canAdd}
            onClick={() =>
              addFrom(
                { ...DEFAULT_ORCHESTRATION_AGENT, description: '', strategy: '' },
                translate('auto.components.settings.OrchestrationAgents.newName', 'New agent')
              )
            }
          >
            <Plus />
            {translate('auto.components.settings.OrchestrationAgents.add', 'New agent')}
          </Button>
        }
      />
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2" role="list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              role="listitem"
              aria-current={agent.id === selected.id ? 'true' : undefined}
              onClick={() => setSelectedId(agent.id)}
              className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2 text-left hover:bg-accent aria-[current=true]:border-foreground/40 aria-[current=true]:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{agent.name}</span>
                {agent.id === DEFAULT_ORCHESTRATION_AGENT.id ? (
                  <Badge variant="outline" className="shrink-0">
                    {translate('auto.components.settings.OrchestrationAgents.default', 'default')}
                  </Badge>
                ) : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">{agentSummary(agent)}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-[999_1_420px]">
          {selected.id === DEFAULT_ORCHESTRATION_AGENT.id ? (
            <div className="space-y-3 rounded-md border border-border p-3 text-sm">
              <p className="text-muted-foreground">{selected.description}</p>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.OrchestrationAgents.builtIn',
                  'Built into Dolphin and kept up to date with it. Duplicate it to change the coordinator, workers, parallelism or add a strategy.'
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAdd}
                onClick={() => addFrom(selected, `${selected.name} (copy)`)}
              >
                {translate('auto.components.settings.OrchestrationAgents.duplicate', 'Duplicate')}
              </Button>
            </div>
          ) : (
            <OrchestrationAgentEditor
              agent={selected}
              goalAgents={goalAgents}
              onChange={(next) =>
                save(custom.map((agent) => (agent.id === next.id ? next : agent)))
              }
              onDuplicate={() => addFrom(selected, `${selected.name} (copy)`)}
              onDelete={() => {
                save(custom.filter((agent) => agent.id !== selected.id))
                setSelectedId(DEFAULT_ORCHESTRATION_AGENT.id)
              }}
            />
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.OrchestrationAgents.rules',
          'Dolphin rules always apply and cannot be edited: one worker per Task in a child worktree, idle between notices, every batch acknowledged, a stalled worker retried once, a blocker only for real decisions, and goal complete at the end.'
        )}
      </p>
    </section>
  )
}
