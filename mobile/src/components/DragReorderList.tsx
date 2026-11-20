import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { GripVertical } from 'lucide-react-native'
import Animated, {
  ReduceMotion,
  measure,
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { colors, spacing } from '../theme/mobile-theme'
import { triggerMediumImpact, triggerSelection } from '../platform/haptics'
import {
  clampDragReorderIndex,
  dragReorderPositionsFromKeys,
  moveDragReorderKey,
  orderedKeysFromDragReorderPositions,
  type DragReorderPositions
} from './drag-reorder-positions'
import { componentsCatalog } from '../i18n/catalogs/components'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

// Rows sliding into a new slot, and the dropped row settling into its own.
const ROW_SPRING = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System }
const LONG_PRESS_ACTIVATION_MS = 200
// Why: joins row keys into a change-detection signature; NUL cannot occur in
// a key, so the joined string is unambiguous.
const KEY_SEPARATOR = '\u0000'
// Why: drags near the viewport edges scroll the outer ScrollView so rows can
// travel further than one screen; speed ramps up the closer the finger gets.
const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_MAX_SPEED = 560

type DragSharedState = {
  positions: SharedValue<DragReorderPositions>
  activeKey: SharedValue<string | null>
  activeTop: SharedValue<number>
  dragStartTop: SharedValue<number>
  dragStartScrollY: SharedValue<number>
  dragTranslationY: SharedValue<number>
  dragPointerAbsY: SharedValue<number>
}

export type DragReorderListProps<ItemT> = {
  items: ItemT[]
  itemKey: (item: ItemT) => string
  rowHeight: number
  renderRow: (item: ItemT) => ReactNode
  /** Called with every item key in the new order after a drop changes it. */
  onReorder: (orderedKeys: string[]) => void
  /** Lets the owning screen disable its ScrollView while a row is held. */
  onDragActiveChange?: (active: boolean) => void
  scrollRef: AnimatedRef<Animated.ScrollView>
  scrollOffsetY: SharedValue<number>
  scrollContentHeight: SharedValue<number>
}

export function DragReorderList<ItemT>({
  items,
  itemKey,
  rowHeight,
  renderRow,
  onReorder,
  onDragActiveChange,
  scrollRef,
  scrollOffsetY,
  scrollContentHeight
}: DragReorderListProps<ItemT>): React.JSX.Element {
  const keys = items.map(itemKey)
  const count = keys.length
  const positions = useSharedValue<DragReorderPositions>(dragReorderPositionsFromKeys(keys))
  const activeKey = useSharedValue<string | null>(null)
  const activeTop = useSharedValue(0)
  const dragStartTop = useSharedValue(0)
  const dragStartScrollY = useSharedValue(0)
  const dragTranslationY = useSharedValue(0)
  const dragPointerAbsY = useSharedValue(0)

  // Why: rows can be added, removed, or reordered by the owning screen;
  // rebuild the position map whenever the rendered key order changes.
  const keySignature = keys.join(KEY_SEPARATOR)
  useEffect(() => {
    positions.value = dragReorderPositionsFromKeys(
      keySignature ? keySignature.split(KEY_SEPARATOR) : []
    )
  }, [keySignature, positions])

  // Why: stable identity keeps each row's memoized gesture from rebuilding.
  const updateDragPosition = useCallback(
    (key: string): void => {
      'worklet'
      const rawTop =
        dragStartTop.value + dragTranslationY.value + (scrollOffsetY.value - dragStartScrollY.value)
      const top = Math.min(Math.max(rawTop, 0), Math.max(0, (count - 1) * rowHeight))
      activeTop.value = top
      const target = clampDragReorderIndex(Math.round(top / rowHeight), count)
      if (positions.value[key] !== target) {
        positions.value = moveDragReorderKey(positions.value, key, target)
        scheduleOnRN(triggerSelection)
      }
    },
    [
      activeTop,
      count,
      dragStartScrollY,
      dragStartTop,
      dragTranslationY,
      positions,
      rowHeight,
      scrollOffsetY
    ]
  )

  // Why: pan updates stop while the finger holds still at a screen edge, so a
  // frame callback keeps scrolling (and re-slotting the row) until it moves.
  const autoScroll = useFrameCallback((frame) => {
    const key = activeKey.value
    if (key === null) {
      return
    }
    const viewport = measure(scrollRef)
    if (viewport) {
      const topEdge = viewport.pageY + AUTO_SCROLL_EDGE
      const bottomEdge = viewport.pageY + viewport.height - AUTO_SCROLL_EDGE
      let velocity = 0
      if (dragPointerAbsY.value < topEdge) {
        velocity =
          -AUTO_SCROLL_MAX_SPEED * Math.min(1, (topEdge - dragPointerAbsY.value) / AUTO_SCROLL_EDGE)
      } else if (dragPointerAbsY.value > bottomEdge) {
        velocity =
          AUTO_SCROLL_MAX_SPEED *
          Math.min(1, (dragPointerAbsY.value - bottomEdge) / AUTO_SCROLL_EDGE)
      }
      if (velocity !== 0) {
        const maxOffset = Math.max(0, scrollContentHeight.value - viewport.height)
        const dtMs = frame.timeSincePreviousFrame ?? 16
        const next = Math.min(
          Math.max(scrollOffsetY.value + (velocity * dtMs) / 1000, 0),
          maxOffset
        )
        if (next !== scrollOffsetY.value) {
          scrollOffsetY.value = next
          scrollTo(scrollRef, 0, next, false)
        }
      }
    }
    updateDragPosition(key)
  }, false)

  const setAutoScrollActive = autoScroll.setActive
  const handleDragActiveChange = useCallback(
    (active: boolean) => {
      setAutoScrollActive(active)
      onDragActiveChange?.(active)
    },
    [setAutoScrollActive, onDragActiveChange]
  )

  const commitReorder = useCallback(
    (orderedKeys: string[]) => {
      // Why: a cancelled or no-op drag should not trigger a persisted write.
      if (orderedKeys.join(KEY_SEPARATOR) !== keySignature) {
        onReorder(orderedKeys)
      }
    },
    [onReorder, keySignature]
  )

  // Why: screen-reader users can't long-press-drag; the handle exposes
  // move up/down accessibility actions that commit the same reorder.
  const moveRowByAccessibilityAction = useCallback(
    (key: string, delta: number) => {
      const fromIndex = keys.indexOf(key)
      if (fromIndex === -1) {
        return
      }
      const toIndex = Math.min(Math.max(fromIndex + delta, 0), keys.length - 1)
      if (toIndex === fromIndex) {
        return
      }
      const next = [...keys]
      next.splice(fromIndex, 1)
      next.splice(toIndex, 0, key)
      onReorder(next)
    },
    [keys, onReorder]
  )

  const shared: DragSharedState = {
    positions,
    activeKey,
    activeTop,
    dragStartTop,
    dragStartScrollY,
    dragTranslationY,
    dragPointerAbsY
  }

  return (
    <View style={{ height: count * rowHeight }}>
      {items.map((item) => (
        <DragReorderRow
          key={itemKey(item)}
          rowKey={itemKey(item)}
          rowHeight={rowHeight}
          shared={shared}
          scrollOffsetY={scrollOffsetY}
          updateDragPosition={updateDragPosition}
          onDragActiveChange={handleDragActiveChange}
          onCommit={commitReorder}
          onAccessibilityMove={moveRowByAccessibilityAction}
        >
          {renderRow(item)}
        </DragReorderRow>
      ))}
    </View>
  )
}

function DragReorderRow({
  rowKey,
  rowHeight,
  shared,
  scrollOffsetY,
  updateDragPosition,
  onDragActiveChange,
  onCommit,
  onAccessibilityMove,
  children
}: {
  rowKey: string
  rowHeight: number
  shared: DragSharedState
  scrollOffsetY: SharedValue<number>
  updateDragPosition: (key: string) => void
  onDragActiveChange: (active: boolean) => void
  onCommit: (orderedKeys: string[]) => void
  onAccessibilityMove: (key: string, delta: number) => void
  children: ReactNode
}): React.JSX.Element {
  const t = useMobileTranslation(componentsCatalog)
  const {
    positions,
    activeKey,
    activeTop,
    dragStartTop,
    dragStartScrollY,
    dragTranslationY,
    dragPointerAbsY
  } = shared

  // Why: the parent re-renders every row on any list change; a rebuilt gesture
  // reattaches its recognizer and can drop a drag in flight.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_ACTIVATION_MS)
        .shouldCancelWhenOutside(false)
        .onStart((event) => {
          const index = positions.value[rowKey] ?? 0
          dragStartTop.value = index * rowHeight
          dragStartScrollY.value = scrollOffsetY.value
          dragTranslationY.value = 0
          dragPointerAbsY.value = event.absoluteY
          activeTop.value = dragStartTop.value
          activeKey.value = rowKey
          scheduleOnRN(onDragActiveChange, true)
          scheduleOnRN(triggerMediumImpact)
        })
        .onUpdate((event) => {
          dragTranslationY.value = event.translationY
          dragPointerAbsY.value = event.absoluteY
          updateDragPosition(rowKey)
        })
        .onFinalize(() => {
          if (activeKey.value !== rowKey) {
            return
          }
          activeKey.value = null
          const orderedKeys = orderedKeysFromDragReorderPositions(positions.value)
          scheduleOnRN(onCommit, orderedKeys)
          scheduleOnRN(onDragActiveChange, false)
        }),
    [
      activeKey,
      activeTop,
      dragPointerAbsY,
      dragStartScrollY,
      dragStartTop,
      dragTranslationY,
      onCommit,
      onDragActiveChange,
      positions,
      rowHeight,
      rowKey,
      scrollOffsetY,
      updateDragPosition
    ]
  )

  // Why: reduce motion keeps the raised colour and shadow but drops the lift scale.
  const reducedMotion = useReducedMotion()
  const liftScale = reducedMotion ? 1 : 1.02
  // Why: rows move by translateY over a fixed top: 0, so neither the held row
  // nor the siblings sliding past it cost a layout pass per frame.
  const rowStyle = useAnimatedStyle(() => {
    const index = positions.value[rowKey] ?? 0
    if (activeKey.value === rowKey) {
      return {
        zIndex: 2,
        elevation: 4,
        shadowOpacity: 0.3,
        backgroundColor: colors.bgRaised,
        transform: [{ translateY: activeTop.value }, { scale: liftScale }]
      }
    }
    return {
      zIndex: 0,
      elevation: 0,
      shadowOpacity: 0,
      backgroundColor: colors.bgPanel,
      transform: [{ translateY: withSpring(index * rowHeight, ROW_SPRING) }, { scale: 1 }]
    }
  }, [positions, activeKey, activeTop, rowKey, rowHeight, liftScale])

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle]}>
      <View style={styles.rowContent}>{children}</View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={styles.handle}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('dragToReorder')}
          accessibilityHint={t('dragToReorderHint')}
          accessibilityActions={[
            { name: 'moveUp', label: t('moveUp') },
            { name: 'moveDown', label: t('moveDown') }
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'moveUp') {
              onAccessibilityMove(rowKey, -1)
            } else if (event.nativeEvent.actionName === 'moveDown') {
              onAccessibilityMove(rowKey, 1)
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <GripVertical size={18} color={colors.textMuted} />
        </Animated.View>
      </GestureDetector>
      <View style={styles.rowSeparator} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8
  },
  rowContent: {
    flex: 1
  },
  handle: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  rowSeparator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle
  }
})
