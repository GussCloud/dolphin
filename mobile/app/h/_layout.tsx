import { useCallback, useEffect, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router'
import { colors } from '../../src/theme/mobile-theme'
import { useResponsiveLayout } from '../../src/layout/responsive-layout'
import {
  HOST_SIDEBAR_DEFAULT_WIDTH,
  loadHostSidebarWidth,
  saveHostSidebarWidth
} from '../../src/storage/preferences'
import { HostProtocolGate } from '../../src/components/HostProtocolGate'
import { HostScreen } from '../../src/host-screen/HostScreen'
import { clampSidebarToWindow } from '../../src/host-screen/host-sidebar-width'
import { useHostSidebarResize } from '../../src/host-screen/use-host-sidebar-resize'
import { hostRoutesCatalog } from '../../src/i18n/catalogs/host-routes'
import { useMobileTranslation } from '../../src/i18n/use-mobile-translation'

const RESIZE_EDGE_WIDTH = 24
const RESIZE_GUIDE_WIDTH = 2

function HostStack({ animation }: { animation: 'none' | 'default' }) {
  const t = useMobileTranslation(hostRoutesCatalog)
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgBase },
        // In the tablet split view the detail pane should swap instantly like
        // a desktop master-detail; the default slide animates the outgoing
        // screen and briefly reveals the one beneath it. Phones keep the slide.
        animation
      }}
    >
      <Stack.Screen name="[hostId]/index" options={{ title: t('routeHost') }} />
      <Stack.Screen name="[hostId]/edit" options={{ title: t('editHost') }} />
      <Stack.Screen name="[hostId]/accounts" options={{ title: t('routeAccounts') }} />
      <Stack.Screen name="[hostId]/tasks" options={{ title: t('routeTasks') }} />
      <Stack.Screen name="[hostId]/session/[worktreeId]" options={{ title: t('routeTerminal') }} />
      <Stack.Screen
        name="[hostId]/source-control/[worktreeId]"
        options={{ title: t('routeSourceControl') }}
      />
      <Stack.Screen
        name="[hostId]/agent-history/[worktreeId]"
        options={{ title: t('routeAgentHistory') }}
      />
      <Stack.Screen name="[hostId]/review/[worktreeId]" options={{ title: t('routeChanges') }} />
      <Stack.Screen name="[hostId]/pr/[worktreeId]" options={{ title: t('routePullRequest') }} />
      {/* Dev-flag only: redirects to the host screen unless the hybrid shell flag is on. */}
      <Stack.Screen name="[hostId]/web" options={{ title: t('routeWorkspace') }} />
      {/* Last, and matched last: every pathname above has a file of its own, so this takes only
          what expo-router would otherwise send to Unmatched. Declared for the title alone — an
          undeclared child still renders, appended after these with this group's screenOptions. */}
      <Stack.Screen name="[hostId]/[...page]" options={{ title: t('routeWorkspace') }} />
    </Stack>
  )
}

export default function HostGroupLayout() {
  // Wide layout = tablet/foldable canvas (see responsive-layout-metrics).
  const { isWideLayout, width: windowWidth } = useResponsiveLayout()
  const { hostId, action } = useGlobalSearchParams<{ hostId?: string; action?: string }>()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(HOST_SIDEBAR_DEFAULT_WIDTH)

  // Read by the one-shot restore below without re-running it on every window change.
  const windowWidthRef = useRef(windowWidth)
  windowWidthRef.current = windowWidth

  // Restore the user's last sidebar width, clamped to the current window.
  useEffect(() => {
    let stale = false
    void loadHostSidebarWidth().then((saved) => {
      if (!stale) {
        setSidebarWidth(clampSidebarToWindow(saved, windowWidthRef.current))
      }
    })
    return () => {
      stale = true
    }
  }, [])

  // Re-clamp when the window shrinks (fold, rotation, split-screen) so the
  // detail pane keeps at least MIN_DETAIL_WIDTH.
  useEffect(() => {
    setSidebarWidth((current) => clampSidebarToWindow(current, windowWidth))
  }, [windowWidth])

  const hideSidebar = useCallback(() => setSidebarOpen(false), [])
  const showSidebar = isWideLayout && !!hostId
  const detailHasContent = !!hostId && pathname !== `/h/${hostId}`
  const canCollapseSidebar = showSidebar && detailHasContent

  // Why: there is no reveal button — navigating Back to the base host route brings
  // the sidebar back (and that route's detail pane is only a placeholder, so a
  // hidden sidebar would leave nothing useful).
  useEffect(() => {
    if (showSidebar && !detailHasContent) {
      setSidebarOpen(true)
    }
  }, [detailHasContent, showSidebar])

  // Why: React (and the worktree list under it) renders once per resize, on release.
  const commitSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width)
    void saveHostSidebarWidth(width)
  }, [])
  // Why: the resizer lives on a dedicated edge handle (a leaf overlay at the
  // sidebar's right border), NOT on the sidebar container, so the worktree
  // list's own scroll never competes with it for the touch.
  const resize = useHostSidebarResize({
    width: sidebarWidth,
    windowWidth,
    onResizeEnd: commitSidebarWidth
  })

  // The detail Stack stays at a stable position in the tree across width
  // changes so a fold/rotation doesn't remount the navigator and reset the
  // navigation stack — only the sidebar pane toggles in and out.
  return (
    <HostProtocolGate hostId={hostId}>
      {/* Why here and not the app root: the web page mounts this tree without app/_layout. */}
      <GestureHandlerRootView style={styles.row}>
        {showSidebar && sidebarOpen ? (
          <View style={[styles.sidebar, { width: sidebarWidth }]}>
            <HostScreen
              embedded
              hostId={hostId}
              action={action}
              onHideSidebar={canCollapseSidebar ? hideSidebar : undefined}
            />
            {/* Dedicated drag handle straddling the right border — see resizer note. */}
            <GestureDetector gesture={resize.gesture}>
              <View style={styles.resizeHandle} />
            </GestureDetector>
          </View>
        ) : null}
        <View style={styles.detail}>
          <HostStack animation={showSidebar ? 'none' : 'default'} />
        </View>
        {showSidebar && sidebarOpen ? (
          <Animated.View pointerEvents="none" style={[styles.resizeGuide, resize.guideStyle]} />
        ) : null}
      </GestureHandlerRootView>
    </HostProtocolGate>
  )
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bgBase
  },
  sidebar: {
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle
  },
  // Invisible grab strip over the sidebar's right edge. Absolute + elevated so it
  // sits above the worktree list and reliably owns the drag on Android.
  resizeHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: RESIZE_EDGE_WIDTH,
    zIndex: 20,
    elevation: 20
  },
  detail: {
    flex: 1,
    minWidth: 0
  },
  // Where the sidebar edge will land, shown only while dragging. Last in the row
  // so it paints over the detail pane when the sidebar is widened.
  resizeGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -RESIZE_GUIDE_WIDTH / 2,
    width: RESIZE_GUIDE_WIDTH,
    backgroundColor: colors.textMuted,
    zIndex: 30,
    elevation: 30
  }
})
