import { memo } from 'react'
import { HostScreenView } from './host-screen-view'
import { type HostScreenProps, useHostScreenController } from './use-host-screen-controller'

/**
 * The worktree list, and the one screen that renders both natively and inside the shell's page.
 *
 * In its own module rather than in the route file because three places mount it: the phone route,
 * the wide-layout sidebar, and the route's web sibling, which cannot import the route file at all
 * — that one reaches the native shell view, whose module calls `requireNativeViewManager` at import
 * and throws in a browser.
 */
// Why memo: the wide-layout sidebar's parent re-renders on every route change, and this is the
// whole worktree list; its props there are strings and a stable callback.
export const HostScreen = memo(function HostScreen(props: HostScreenProps = {}) {
  const controller = useHostScreenController(props)
  return <HostScreenView controller={controller} />
})
