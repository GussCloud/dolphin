import { AgentIcon } from '@/lib/agent-catalog'
import { useAppStore } from '@/store'
import { isTuiAgent } from '../../../../shared/tui-agent-config'

/** The pane's live agent glyph; renders nothing until the status store names a known agent. */
export default function PaneTitleAgentMark({
  paneKey
}: {
  paneKey: string
}): React.JSX.Element | null {
  const agentType = useAppStore((state) => state.agentStatusByPaneKey[paneKey]?.agentType)
  if (!isTuiAgent(agentType)) {
    return null
  }
  return (
    <span className="pane-title-agent-mark" aria-hidden>
      <AgentIcon agent={agentType} size={12} />
    </span>
  )
}
