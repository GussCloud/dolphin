import { useMemo } from 'react'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { useAppStore } from '../../store'
import {
  selectEvictionExemptTerminalTabIds,
  selectEvictionExemptTerminalTabLayoutKey
} from './terminal-eviction-exempt-tabs'

const EMPTY_TAB_IDS: ReadonlySet<string> = new Set()

/** Tabs of a force-parked worktree that keep their mounted panes (a remount would orphan a live
 *  PTY); empty unless force-parked. */
export function useEvictionExemptTerminalTabIds(
  worktreeId: string,
  terminalTabs: readonly TerminalTab[],
  isForceParked: boolean
): ReadonlySet<string> {
  // Why subscribed: the exemption also reads layout leaf PTYs, which change
  // without a terminalTabs change (split added, pty re-minted); gated on
  // isForceParked so only force-parked worktrees build the key per store change.
  const evictionExemptLayoutKey = useAppStore((state) =>
    isForceParked ? selectEvictionExemptTerminalTabLayoutKey(state, terminalTabs) : ''
  )
  // Why memoized: resolving an exemption re-reads the store and walks the
  // layout tree per tab, so recompute only when the force-park verdict, the
  // tabs, or their layout PTYs change — not on every assignment/park-set change.
  return useMemo(
    () =>
      isForceParked ? selectEvictionExemptTerminalTabIds(worktreeId, terminalTabs) : EMPTY_TAB_IDS,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the layout key encodes the store fields the selector re-reads internally.
    [evictionExemptLayoutKey, isForceParked, terminalTabs, worktreeId]
  )
}
