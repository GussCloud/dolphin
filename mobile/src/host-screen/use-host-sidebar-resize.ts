import { useMemo } from 'react'
import { Gesture, type PanGesture } from 'react-native-gesture-handler'
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { clampSidebarToWindow, resolveSidebarDragEdge } from './host-sidebar-width'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// Why: the guide is the only feedback; reduce motion keeps its fade, the spring goes instant.
const GUIDE_FADE_IN = { duration: 120, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }
const GUIDE_FADE_OUT = { duration: 150, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }

type Options = {
  width: number
  windowWidth: number
  onResizeEnd: (width: number) => void
}

type HostSidebarResize = {
  gesture: PanGesture
  guideStyle: ReturnType<typeof useAnimatedStyle>
}

/**
 * Drags a guide line on the UI thread and commits the width to React once, on release.
 *
 * Why a guide and not a live width: the sidebar holds the whole worktree list, so a per-frame width
 * re-lays-out and re-measures every visible row (and the detail pane beside it). The guide is a
 * childless absolute line moved by translateX, which costs no layout at all.
 */
export function useHostSidebarResize({
  width,
  windowWidth,
  onResizeEnd
}: Options): HostSidebarResize {
  const edge = useSharedValue(width)
  const guideOpacity = useSharedValue(0)

  // Why: memoized so a parent re-render cannot reattach the recognizer mid-drag.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Claims on touch-down, as the PanResponder did: nothing sits under the edge handle.
        .minDistance(0)
        .onStart(() => {
          cancelAnimation(edge)
          edge.value = width
          guideOpacity.value = withTiming(1, GUIDE_FADE_IN)
        })
        .onUpdate((e) => {
          edge.value = resolveSidebarDragEdge(width + e.translationX, windowWidth)
        })
        .onEnd((e) => {
          const next = clampSidebarToWindow(width + e.translationX, windowWidth)
          // Settles a rubber-banded guide back onto the limit it was pulled past.
          edge.value = withSpring(next, {
            duration: 300,
            dampingRatio: 1,
            velocity: e.velocityX,
            reduceMotion: ReduceMotion.System
          })
          guideOpacity.value = withTiming(0, GUIDE_FADE_OUT)
          if (next !== width) {
            scheduleOnRN(onResizeEnd, next)
          }
        }),
    [edge, guideOpacity, onResizeEnd, width, windowWidth]
  )

  const guideStyle = useAnimatedStyle(
    () => ({
      opacity: guideOpacity.value,
      transform: [{ translateX: edge.value }]
    }),
    [edge, guideOpacity]
  )

  return { gesture, guideStyle }
}
