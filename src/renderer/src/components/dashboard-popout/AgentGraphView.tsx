import { memo, useMemo } from 'react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { AgentStateDot } from '@/components/AgentStateDot'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  dashboardCardDisplayState,
  type DashboardCard,
  type DashboardCardSubagent
} from '../../../../shared/dashboard-snapshot'
import { AGENT_GRAPH_NODE_WIDTH, layoutAgentGraph, type AgentGraphEdge } from './agent-graph-layout'

function AgentGraphEdgePath({ edge }: { edge: AgentGraphEdge }): React.JSX.Element {
  return (
    <path
      data-testid="agent-graph-edge"
      d={edge.path}
      fill="none"
      strokeWidth={1.25}
      strokeDasharray={edge.subagent ? '3 3' : undefined}
      className={cn(
        edge.childState === 'blocked' || edge.childState === 'waiting'
          ? 'stroke-agent-question/70'
          : edge.childState === 'working'
            ? 'stroke-foreground/35'
            : 'stroke-border'
      )}
    />
  )
}

type AgentNodeProps = {
  card: DashboardCard
  x: number
  y: number
  height: number
  onOpenTerminal: (card: DashboardCard) => void
}

const AgentGraphAgentNode = memo(
  function AgentGraphAgentNode({
    card,
    x,
    y,
    height,
    onOpenTerminal
  }: AgentNodeProps): React.JSX.Element {
    const needsYou = card.bucket === 'attention'
    const heading = card.conversationName ?? card.worktreeName
    const detail = card.askSummary ?? card.lastAgentMessage ?? card.task
    return (
      <button
        type="button"
        data-testid="agent-graph-node"
        onClick={() => onOpenTerminal(card)}
        style={{ left: x, top: y, width: AGENT_GRAPH_NODE_WIDTH, height }}
        className={cn(
          'absolute flex flex-col justify-center gap-0.5 overflow-hidden rounded-lg border px-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          needsYou
            ? 'border-agent-question/40 bg-agent-question/[0.06] hover:border-agent-question/60'
            : 'border-border/60 bg-card hover:border-border hover:bg-accent/40'
        )}
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="inline-flex shrink-0">
            <AgentIcon agent={agentTypeToIconAgent(card.agentType)} size={13} />
          </span>
          <span
            className={cn(
              'truncate text-[12px]',
              card.unseen ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {heading}
          </span>
          {needsYou ? (
            <AgentQuestionIcon className="ml-auto size-3 shrink-0" />
          ) : (
            <AgentStateDot state={dashboardCardDisplayState(card)} className="ml-auto" />
          )}
        </span>
        {detail ? (
          <span className="line-clamp-1 text-[11px] leading-snug text-foreground/80">{detail}</span>
        ) : null}
        {card.conversationName ? (
          <span className="truncate text-[10.5px] text-muted-foreground">{card.worktreeName}</span>
        ) : null}
      </button>
    )
  },
  (previous, next) =>
    previous.x === next.x &&
    previous.y === next.y &&
    previous.height === next.height &&
    previous.onOpenTerminal === next.onOpenTerminal &&
    previous.card.paneKey === next.card.paneKey &&
    previous.card.agentType === next.card.agentType &&
    previous.card.bucket === next.card.bucket &&
    previous.card.dotState === next.card.dotState &&
    previous.card.workingMode === next.card.workingMode &&
    previous.card.unseen === next.card.unseen &&
    previous.card.conversationName === next.card.conversationName &&
    previous.card.worktreeName === next.card.worktreeName &&
    previous.card.askSummary === next.card.askSummary &&
    previous.card.lastAgentMessage === next.card.lastAgentMessage &&
    previous.card.task === next.card.task
)

function AgentGraphSubagentNode({
  subagent,
  x,
  y,
  height
}: {
  subagent: DashboardCardSubagent
  x: number
  y: number
  height: number
}): React.JSX.Element {
  return (
    <div
      data-testid="agent-graph-subagent"
      style={{ left: x, top: y, width: AGENT_GRAPH_NODE_WIDTH, height }}
      className="absolute flex items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-border/70 bg-muted/30 px-2.5 text-[11px] text-muted-foreground"
    >
      <AgentStateDot state={subagent.dotState} />
      <span className="truncate">{subagent.name}</span>
    </div>
  )
}

/** Live parent → child view of the board's cards. Built only from the snapshot
 *  the board already holds, so it adds no polling, IPC, or host work. */
export function AgentGraphView({
  cards,
  onOpenTerminal
}: {
  cards: DashboardCard[]
  onOpenTerminal: (card: DashboardCard) => void
}): React.JSX.Element {
  const layout = useMemo(() => layoutAgentGraph(cards), [cards])

  if (layout.nodes.length === 0) {
    return (
      <p className="px-1 py-2 text-[11px] text-muted-foreground">
        {translate('dashboardPopout.graph.empty', 'No agents to show')}
      </p>
    )
  }

  return (
    <div
      data-testid="agent-graph"
      className="relative mx-auto shrink-0"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
      >
        {layout.edges.map((edge) => (
          <AgentGraphEdgePath key={edge.id} edge={edge} />
        ))}
      </svg>
      {layout.nodes.map((node) =>
        node.kind === 'agent' ? (
          <AgentGraphAgentNode
            key={node.id}
            card={node.card}
            x={node.x}
            y={node.y}
            height={node.height}
            onOpenTerminal={onOpenTerminal}
          />
        ) : (
          <AgentGraphSubagentNode
            key={node.id}
            subagent={node.subagent}
            x={node.x}
            y={node.y}
            height={node.height}
          />
        )
      )}
    </div>
  )
}
