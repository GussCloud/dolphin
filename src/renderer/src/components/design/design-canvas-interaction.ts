import { createContext, useContext, type ReactNode } from 'react'
import type { DesignBlock } from '../../../../shared/design-types'
import type { DesignBlockActivity } from './design-conversation'

/** What the read-only canvas needs from the detail view; a context keeps it out of node data. */
export type DesignCanvasInteraction = {
  activity: ReadonlyMap<string, DesignBlockActivity>
  /** Block a hovered decision is about. */
  highlightedBlockId: string | null
  openBlockId: string | null
  setOpenBlockId: (blockId: string | null) => void
  renderBlockThread: (block: DesignBlock) => ReactNode
}

const INERT: DesignCanvasInteraction = {
  activity: new Map(),
  highlightedBlockId: null,
  openBlockId: null,
  setOpenBlockId: () => {},
  renderBlockThread: () => null
}

export const DesignCanvasInteractionContext = createContext<DesignCanvasInteraction>(INERT)

export function useDesignCanvasInteraction(): DesignCanvasInteraction {
  return useContext(DesignCanvasInteractionContext)
}
