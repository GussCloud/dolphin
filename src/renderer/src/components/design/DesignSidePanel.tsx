import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import {
  isDesignDecisionOpen,
  latestDesignCanvas,
  pendingDesignInbox,
  type Design
} from '../../../../shared/design-types'
import { designDeliveryState, sortDesignDecisions } from './design-conversation'
import { DesignActivityTimeline } from './DesignActivityTimeline'
import { DesignDecisionCard } from './DesignDecisionCard'
import { DesignDeliveryBanner } from './DesignDeliveryBanner'
import { DesignThread } from './DesignThread'

export type DesignSidePanelTab = 'decisions' | 'conversation' | 'activity'

function isSidePanelTab(value: string): value is DesignSidePanelTab {
  return value === 'decisions' || value === 'conversation' || value === 'activity'
}

/** Decisions to answer, the general conversation and the activity log, beside the canvas. */
export function DesignSidePanel({
  design,
  tab,
  onTabChange,
  onAnswer,
  onComment,
  onResend,
  onHoverBlock
}: {
  design: Design
  tab: DesignSidePanelTab
  onTabChange: (tab: DesignSidePanelTab) => void
  onAnswer: (input: { decisionId: string; selected: string[]; note?: string }) => Promise<void>
  onComment: (input: { blockId?: string; text: string }) => Promise<void>
  onResend: () => Promise<void>
  onHoverBlock: (blockId: string | null) => void
}): React.JSX.Element {
  // Why a tick: the notify-now hint appears after a delay with no design change to re-render on.
  const now = useNow(15_000, pendingDesignInbox(design).length > 0)
  const decisions = sortDesignDecisions(design.decisions)
  const openCount = design.decisions.filter(isDesignDecisionOpen).length
  const blockTitles = new Map(
    (latestDesignCanvas(design)?.canvas.groups ?? []).flatMap((group) =>
      group.blocks.map((block) => [block.id, block.title] as const)
    )
  )
  return (
    <aside
      data-design-side-panel=""
      className="flex min-h-0 w-96 shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3"
    >
      <DesignDeliveryBanner state={designDeliveryState(design, now)} onResend={onResend} />
      <Tabs
        value={tab}
        onValueChange={(value) => isSidePanelTab(value) && onTabChange(value)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="w-full">
          <TabsTrigger value="decisions">
            {openCount > 0
              ? translate('auto.components.design.panel.decisionsCount', 'Decisions ({{value0}})', {
                  value0: openCount
                })
              : translate('auto.components.design.panel.decisions', 'Decisions')}
          </TabsTrigger>
          <TabsTrigger value="conversation">
            {translate('auto.components.design.panel.conversation', 'Conversation')}
          </TabsTrigger>
          <TabsTrigger value="activity">
            {translate('auto.components.design.panel.activity', 'Activity')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="decisions" className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-sleek min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.design.panel.noDecisions',
                  'The agent has not asked anything yet.'
                )}
              </p>
            ) : (
              decisions.map((decision) => (
                <DesignDecisionCard
                  key={decision.id}
                  decision={decision}
                  blockTitle={decision.blockId ? (blockTitles.get(decision.blockId) ?? null) : null}
                  onAnswer={onAnswer}
                  onHoverChange={onHoverBlock}
                />
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="conversation" className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto pr-1">
            <DesignThread
              messages={design.messages}
              blockId={undefined}
              placeholder={translate(
                'auto.components.design.panel.conversationPlaceholder',
                'Ask or request a change to the whole design'
              )}
              onSend={(text) => onComment({ text })}
            />
          </div>
        </TabsContent>
        <TabsContent value="activity" className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto pr-1">
            <DesignActivityTimeline design={design} />
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
