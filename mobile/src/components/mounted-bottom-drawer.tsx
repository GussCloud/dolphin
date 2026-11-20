import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Keyboard,
  Modal,
  Platform
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useReducedMotion,
  withTiming,
  interpolate,
  Extrapolation
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { spacing } from '../theme/mobile-theme'
import { resolveBottomDrawerFillHeight } from './bottom-drawer-fill-height'
import { resolveBottomDrawerKeyboardInset } from './bottom-drawer-keyboard-inset'
import { BOTTOM_DRAWER_HIDE_DURATION_MS } from './bottom-drawer-constants'
import { drawerDismiss, drawerProgressTiming, drawerSnapBack, grabDrawer } from './drawer-motion'
import { bottomDrawerStyles as styles } from './bottom-drawer-styles'
import { useInsideBottomDrawerModalHost } from './bottom-drawer-modal-host'
import { useResponsiveLayout } from '../layout/responsive-layout'
import { useBackClaim } from '../navigation/use-back-claim'
import { currentSoftKeyboardHeight, subscribeSoftKeyboard } from '../platform/keyboard-occlusion'
import { componentsCatalog } from '../i18n/catalogs/components'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

const DISMISS_THRESHOLD = 80
// Why: negative translateY (pulling up) is damped with a rubber-band factor
// so the drawer resists upward dragging — a subtle polish touch that signals
// the drawer cannot expand further.
const RUBBER_BAND_FACTOR = 0.25
const SHOW_DURATION = 180
const TOP_SCROLL_EPSILON = 1

export type MountedBottomDrawerProps = {
  visible: boolean
  onClose: () => void
  onHidden: () => void
  children: ReactNode
  dragContentToDismiss?: boolean
  contentScrollable?: boolean
  fillAvailable?: boolean
  // Why: outer sheets pinned under an inner fill picker stay laid out (size
  // preserved) but must not take touches, stack backdrops, or keyboard-lift.
  interactive?: boolean
  zIndex?: number
}

export function MountedBottomDrawer({
  visible,
  onClose,
  onHidden,
  children,
  dragContentToDismiss = true,
  contentScrollable = true,
  fillAvailable = false,
  interactive = true,
  zIndex = 1000
}: MountedBottomDrawerProps) {
  const t = useMobileTranslation(componentsCatalog)
  const translateY = useSharedValue(0)
  const progress = useSharedValue(0)
  const keyboardOffset = useSharedValue(0)
  const scrollOffsetY = useSharedValue(0)
  const contentDragStartY = useSharedValue(0)
  const contentDragCanDismiss = useSharedValue(false)
  // Where the sheet was when the finger took it, so a grab mid-settle doesn't jump.
  const dragOrigin = useSharedValue(0)
  // Why: reduce motion swaps the slide for a crossfade (see drawerStyle).
  const reducedMotion = useReducedMotion()
  // Why: fill mode needs the keyboard inset in React layout (not only the
  // reanimated translate) so height shrinks as the sheet lifts and the top
  // edge stays under the status bar.
  const [keyboardInset, setKeyboardInset] = useState(0)
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Why: on wide/tablet canvases a full-width sheet looks stretched; cap it and
  // center it horizontally. Vertical bottom-anchoring (and all the drag/keyboard
  // transforms below) is unchanged, so phone behavior stays identical.
  const { isWideLayout, modalMaxWidth } = useResponsiveLayout()
  const insideModalHost = useInsideBottomDrawerModalHost()
  const fillHeight = fillAvailable
    ? resolveBottomDrawerFillHeight({
        screenHeight,
        topInset: insets.top,
        keyboardInset,
        topGap: spacing.lg
      })
    : undefined

  // Why: a sheet pinned under a fill picker holds progress at its target while the
  // picker owns the window, so nothing re-applies its transform when the picker
  // leaves. If the native view was rebuilt underneath, it keeps a stale transform
  // and never paints — a dimmed, dead screen the user can only escape by dismissing
  // the whole modal. A shared-value write alone cannot heal that (verified on
  // device: an unchanged or nudged style lands on the stale native binding), so the
  // remount is what repaints; the writes below keep the shared values authoritative
  // for the fresh view, which matters because the drawer swap (166ms) hands back
  // before the 180ms enter animation has finished.
  const [windowEpoch, setWindowEpoch] = useState(0)
  const wasInteractiveRef = useRef(interactive)
  useEffect(() => {
    const tookWindowBack = visible && interactive && !wasInteractiveRef.current
    wasInteractiveRef.current = interactive
    if (!tookWindowBack) {
      return
    }
    translateY.value = 0
    progress.value = drawerProgressTiming(1, SHOW_DURATION)
    setWindowEpoch((epoch) => epoch + 1)
  }, [interactive, visible])

  useEffect(() => {
    if (visible) {
      translateY.value = 0
      scrollOffsetY.value = 0
      progress.value = drawerProgressTiming(1, SHOW_DURATION)
    } else {
      Keyboard.dismiss()
      setKeyboardInset(0)
      progress.value = drawerProgressTiming(0, BOTTOM_DRAWER_HIDE_DURATION_MS, (finished) => {
        if (finished) {
          scheduleOnRN(onHidden)
        }
      })
    }
  }, [onHidden, visible])

  // Why: KeyboardAvoidingView and useAnimatedKeyboard are both unreliable
  // inside Modal (iOS ignores KAV; Android needs adjustNothing for
  // useAnimatedKeyboard). The keyboard seam's events work on both platforms
  // and give the exact height; inside the shell's page none fire, because
  // the shell shortens the WebView above the IME.
  useEffect(() => {
    // Pinned-under sheets stay visible for size but must not ride the keyboard —
    // only the top interactive sheet owns inset/lift.
    if (!visible || !interactive) {
      keyboardOffset.value = 0
      setKeyboardInset(0)
      return
    }

    function applyKeyboardHeight(keyboardHeight: number, duration = 0): void {
      const inset = resolveBottomDrawerKeyboardInset({
        keyboardHeight,
        bottomInset: insets.bottom,
        fillAvailable,
        platform: Platform.OS
      })
      setKeyboardInset(inset)
      if (duration > 0) {
        keyboardOffset.value = withTiming(inset, { duration })
      } else {
        keyboardOffset.value = inset
      }
    }

    // Why: fill sheets dock to the true keyboard top; autoFocus can raise the
    // keyboard before listeners attach. Seed only in fill mode so content-sized
    // outer sheets do not inherit a stale metrics height after an inner dismiss.
    if (fillAvailable) {
      const existing = currentSoftKeyboardHeight()
      if (existing > 0) {
        applyKeyboardHeight(existing)
      }
    }

    const unsubscribe = subscribeSoftKeyboard(
      (height, duration) => {
        applyKeyboardHeight(height, duration || 250)
      },
      (duration) => {
        setKeyboardInset(0)
        keyboardOffset.value = withTiming(0, { duration: duration || 250 })
      }
    )

    return () => {
      unsubscribe()
      keyboardOffset.value = 0
      setKeyboardInset(0)
    }
  }, [visible, interactive, insets.bottom, fillAvailable])

  const dismiss = useCallback(() => {
    // Why: restarting the hide cancels it, so onHidden never fires and the invisible
    // Modal keeps swallowing taps (Android Back lands here mid-close).
    if (!visible) {
      return
    }
    Keyboard.dismiss()
    progress.value = drawerProgressTiming(0, BOTTOM_DRAWER_HIDE_DURATION_MS, (finished) => {
      if (finished) {
        scheduleOnRN(onClose)
      }
    })
  }, [onClose, progress, visible])

  // One seam, both platforms: natively this is the hardware key, and inside the shell's page it is
  // a claim the shell hands one press over on. Every session sheet renders through this component,
  // so this one claim is what makes Android Back close the sheet rather than leave the screen.
  // Only the top interactive drawer claims; a sheet pinned under a fill picker does not own the key.
  useBackClaim(
    visible && interactive
      ? () => {
          dismiss()
          return true
        }
      : null
  )

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffsetY.value = Math.max(event.contentOffset.y, 0)
  })

  // Why: the backdrop already fades off translateY while the sheet springs away;
  // progress drops only once it is gone, so the slide is one velocity-carrying spring.
  const finishDragDismiss = useCallback(() => {
    progress.value = 0
    onClose()
  }, [onClose, progress])

  // Why: memoized so a re-render mid-drag (keyboard inset, parent state) cannot
  // reattach the recognizers and drop the drag.
  const scrollGesture = useMemo(() => Gesture.Native(), [])
  const { handlePanGesture, contentPanGesture } = useMemo(() => {
    const followFinger = (dragY: number): void => {
      'worklet'
      const next = dragOrigin.value + dragY
      translateY.value = next > 0 ? next : next * RUBBER_BAND_FACTOR
    }
    const release = (velocityY: number): void => {
      'worklet'
      if (translateY.value > DISMISS_THRESHOLD || velocityY > 500) {
        translateY.value = drawerDismiss(screenHeight, velocityY, finishDragDismiss)
      } else {
        translateY.value = drawerSnapBack(velocityY)
      }
    }
    const handle = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .simultaneousWithExternalGesture(scrollGesture)
      .onStart(() => {
        dragOrigin.value = grabDrawer(translateY)
      })
      .onUpdate((e) => {
        followFinger(e.translationY)
      })
      .onEnd((e) => {
        release(e.velocityY)
      })
    const content = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .simultaneousWithExternalGesture(scrollGesture)
      .onBegin(() => {
        contentDragStartY.value = 0
        contentDragCanDismiss.value = scrollOffsetY.value <= TOP_SCROLL_EPSILON
      })
      .onUpdate((e) => {
        // Why: action-sheet content can be taller than the drawer; downward drags
        // should scroll back to the top before they start dismissing the sheet.
        if (scrollOffsetY.value > TOP_SCROLL_EPSILON) {
          // Why: start the snap-back once; restarting it every frame would never let it settle.
          const wasDismissing = contentDragCanDismiss.value
          contentDragCanDismiss.value = false
          contentDragStartY.value = 0
          if (wasDismissing && translateY.value !== 0) {
            translateY.value = drawerSnapBack(0)
          }
          return
        }

        if (!contentDragCanDismiss.value) {
          contentDragCanDismiss.value = true
          contentDragStartY.value = e.translationY
          dragOrigin.value = grabDrawer(translateY)
        }

        followFinger(e.translationY - contentDragStartY.value)
      })
      .onEnd((e) => {
        if (!contentDragCanDismiss.value || scrollOffsetY.value > TOP_SCROLL_EPSILON) {
          return
        }
        release(e.velocityY)
      })
    return { handlePanGesture: handle, contentPanGesture: content }
  }, [
    contentDragCanDismiss,
    contentDragStartY,
    dragOrigin,
    finishDragDismiss,
    screenHeight,
    scrollGesture,
    scrollOffsetY,
    translateY
  ])

  const drawerStyle = useAnimatedStyle(() => {
    // Why: fill mode already shrinks height by the keyboard inset and lifts via
    // marginBottom (layout). Also subtracting keyboardOffset here would double-
    // count and park the dock under the keys (input hidden).
    const keyboardShift = fillAvailable ? 0 : keyboardOffset.value
    if (reducedMotion) {
      return {
        opacity: progress.value,
        transform: [{ translateY: translateY.value - keyboardShift }]
      }
    }
    return {
      opacity: 1,
      transform: [
        {
          translateY:
            interpolate(progress.value, [0, 1], [screenHeight, 0], Extrapolation.CLAMP) +
            translateY.value -
            keyboardShift
        }
      ]
    }
  }, [progress, translateY, keyboardOffset, screenHeight, fillAvailable, reducedMotion])

  const backdropStyle = useAnimatedStyle(() => {
    const dragFade = interpolate(translateY.value, [0, 300], [1, 0], Extrapolation.CLAMP)
    return { opacity: progress.value * dragFade }
  }, [progress, translateY])

  // Why: the sheet renders through a full-screen native window (its own Modal
  // below, or the shared BottomDrawerModalHost) so it always covers the viewport
  // — even when mounted deep inside a ScrollView, where a plain absolute overlay
  // anchors to the scrolled content and clips the sheet. Show/hide is driven by
  // `progress` (animationType "none") so the reanimated exit animation runs before
  // the parent unmounts us.
  const handle = (
    <GestureDetector gesture={handlePanGesture}>
      <Animated.View
        style={styles.handleHitArea}
        accessibilityRole="button"
        accessibilityLabel={t('dismissDrawer')}
      >
        <View style={styles.handle} />
      </Animated.View>
    </GestureDetector>
  )

  const body = !contentScrollable ? (
    <>
      {handle}
      <View style={[styles.staticContent, fillAvailable && styles.staticContentFill]}>
        {children}
      </View>
    </>
  ) : dragContentToDismiss ? (
    <>
      {handle}
      <GestureDetector gesture={contentPanGesture}>
        <Animated.View collapsable={false}>
          <GestureDetector gesture={scrollGesture}>
            <Animated.ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </Animated.ScrollView>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </>
  ) : (
    <>
      {handle}
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </>
  )

  const overlay = (
    <Animated.View
      pointerEvents={visible && interactive ? 'auto' : 'none'}
      style={[styles.overlay, { zIndex, elevation: zIndex }]}
      accessibilityViewIsModal={interactive}
      aria-modal={interactive}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          // Why: pinned-under outer sheets keep progress=1 so size stays; hide
          // their backdrop so only the top interactive drawer dims the canvas.
          style={[styles.backdrop, interactive ? backdropStyle : { opacity: 0 }]}
        >
          {interactive ? <Pressable style={styles.backdropPressable} onPress={dismiss} /> : null}
        </Animated.View>

        <View style={[styles.anchor, isWideLayout && styles.anchorWide]} pointerEvents="box-none">
          <Animated.View
            // Why: remount per window hand-back — see the windowEpoch effect.
            key={windowEpoch}
            // The sheet names itself so a check can find it without reading its styling.
            testID="bottom-drawer-sheet"
            style={[
              styles.drawer,
              fillAvailable ? styles.drawerFill : null,
              {
                width: '100%',
                maxWidth: isWideLayout ? modalMaxWidth : undefined,
                maxHeight: screenHeight - insets.top - spacing.lg,
                // Why: fill sheets shrink height AND lift with marginBottom so the
                // bottom edge sits on the keyboard top (height alone still leaves
                // the dock in the keyboard’s footprint). Non-fill sheets keep
                // the legacy translateY keyboard shift instead.
                height: fillHeight,
                marginBottom: fillAvailable ? keyboardInset : 0,
                paddingBottom:
                  fillAvailable && keyboardInset > 0 ? spacing.sm : insets.bottom + spacing.lg
              },
              drawerStyle
            ]}
          >
            {body}
            <View style={styles.bottomExtension} />
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Animated.View>
  )

  // Why: inside a BottomDrawerModalHost the host owns the single native Modal;
  // rendering our own would stack modals and reintroduce the iOS present/dismiss
  // race the host exists to avoid. The host handles the Android back button.
  if (insideModalHost) {
    return overlay
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      {overlay}
    </Modal>
  )
}
