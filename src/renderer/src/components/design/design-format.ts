import { getAgentCatalog } from '@/lib/agent-catalog'

const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function formatDesignTimestamp(at: number): string {
  return DATE_TIME.format(at)
}

/** Catalog label, or the raw id when the host names an agent this client doesn't know. */
export function designAgentLabel(agent: string): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}
