import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  withSpring,
  withTiming,
  type SharedValue
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Show/hide and drag-release motion shared by the bottom sheet and the right drawer.

// iOS sheet curve; withTiming's default in-out quad starts slow exactly when the sheet appears.
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1)

/**
 * Animates a drawer's open progress and runs `onFinished` on the RN runtime once it lands. Never
 * reduced: with reduce motion it drives a crossfade.
 */
export function drawerProgressTiming(
  to: number,
  duration: number,
  onFinished?: () => void
): number {
  'worklet'
  return withTiming(
    to,
    { duration, easing: EASE_SHEET, reduceMotion: ReduceMotion.Never },
    // Why inline: only a callback written in the withTiming call is workletized; one passed in is a
    // plain function, which a release build hands the UI thread as an uncallable object (a crash).
    (finished) => {
      if (finished && onFinished) {
        scheduleOnRN(onFinished)
      }
    }
  )
}

/** Stops a running settle and returns where the drawer is, so a re-grab continues from there. */
export function grabDrawer(offset: SharedValue<number>): number {
  'worklet'
  cancelAnimation(offset)
  return offset.value
}

/** Springs a released drawer back to rest, carrying the finger's velocity. */
export function drawerSnapBack(velocity: number): number {
  'worklet'
  return withSpring(0, {
    duration: 300,
    dampingRatio: 0.8,
    velocity,
    reduceMotion: ReduceMotion.System
  })
}

/** Springs a flicked drawer off screen and runs `onDismissed` on the RN runtime once it lands. */
export function drawerDismiss(
  offscreen: number,
  velocity: number,
  onDismissed: () => void
): number {
  'worklet'
  return withSpring(
    offscreen,
    {
      duration: 300,
      dampingRatio: 1,
      velocity,
      // Why: a bounce past the edge would flash a gap below or beside the sheet.
      overshootClamping: true,
      reduceMotion: ReduceMotion.System
    },
    (finished) => {
      // A re-grab mid-flight cancels the spring; that drawer is not dismissed.
      if (finished) {
        scheduleOnRN(onDismissed)
      }
    }
  )
}
