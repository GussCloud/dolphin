import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import type { RefObject } from 'react'
import type { DiffComment } from '../../../src/shared/diff-comment-types'
import { colors } from '../theme/mobile-theme'
import { MobileDiffReviewLine } from './MobileDiffReviewLine'
import type {
  ReviewDiffLine,
  ReviewDiffState,
  ReviewScreenState
} from '../session/mobile-diff-review-screen-model'
import type { MobileDiffReviewQueueItem } from '../session/mobile-diff-review-queue'
import { mobileDiffReviewStyles as styles } from './mobile-diff-review-screen-styles'
import { componentsDiffReviewCatalog } from '../i18n/catalogs/components-diff-review'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Props = {
  activeHunkIndex: number | null
  commentsByLine: ReadonlyMap<number, DiffComment[]>
  currentItem: MobileDiffReviewQueueItem | null
  diffState: ReviewDiffState
  filteredCount: number
  listRef: RefObject<FlatList<ReviewDiffLine> | null>
  screenState: ReviewScreenState
  staleCommentIds: ReadonlySet<string>
  onAddNote: (lineNumber: number) => void
  onEditNote: (comment: DiffComment) => void
  onRetry: (() => void) | undefined
}

export function MobileDiffReviewBody({
  activeHunkIndex,
  commentsByLine,
  currentItem,
  diffState,
  filteredCount,
  listRef,
  screenState,
  staleCommentIds,
  onAddNote,
  onEditNote,
  onRetry
}: Props) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  if (screenState.kind === 'loading') {
    return <CenteredState text={t('loadingReview')} busy />
  }
  if (screenState.kind === 'error' || screenState.kind === 'unavailable') {
    return (
      <CenteredState
        title={
          screenState.kind === 'unavailable' ? t('reviewUnavailable') : t('unableToLoadReview')
        }
        text={screenState.message}
        onRetry={onRetry}
      />
    )
  }
  if (filteredCount === 0) {
    return <CenteredState title={t('noReviewableChanges')} text={t('tryDifferentFilter')} />
  }
  if (diffState.kind === 'loading') {
    return <CenteredState text={t('loadingDiff')} busy muted />
  }
  if (diffState.kind !== 'ready') {
    return <DiffUnavailableState diffState={diffState} onRetry={onRetry} />
  }
  return (
    <FlatList
      ref={listRef}
      data={diffState.lines}
      keyExtractor={(_, index) => `${currentItem?.key ?? 'diff'}:${index}`}
      renderItem={({ item, index }) => {
        const lineNumber = item.newLineNumber ?? -1
        const active =
          activeHunkIndex !== null &&
          index >= (diffState.hunks[activeHunkIndex]?.startIndex ?? -1) &&
          index <= (diffState.hunks[activeHunkIndex]?.endIndex ?? -1)
        return (
          <MobileDiffReviewLine
            line={item}
            comments={commentsByLine.get(lineNumber) ?? []}
            staleCommentIds={staleCommentIds}
            active={active}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
          />
        )
      }}
      contentContainerStyle={styles.diffList}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, info.averageItemLength * info.index),
          animated: true
        })
      }}
      ListFooterComponent={
        diffState.truncated ? <Text style={styles.truncatedText}>{t('diffTruncated')}</Text> : null
      }
    />
  )
}

function DiffUnavailableState({
  diffState,
  onRetry
}: {
  diffState: ReviewDiffState
  onRetry: (() => void) | undefined
}) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  const title =
    diffState.kind === 'binary'
      ? t('binaryDiff')
      : diffState.kind === 'too-large'
        ? t('diffTooLarge')
        : diffState.kind === 'deleted'
          ? t('deletedFile')
          : t('diffUnavailable')
  const text =
    diffState.kind === 'binary'
      ? t('binaryDiffMessage')
      : diffState.kind === 'too-large'
        ? t('diffTooLargeMessage')
        : diffState.kind === 'deleted'
          ? t('deletedFileMessage')
          : diffState.kind === 'error'
            ? diffState.message
            : t('selectFileToReview')
  return <CenteredState title={title} text={text} onRetry={onRetry} />
}

function CenteredState({
  busy,
  muted,
  title,
  text,
  onRetry
}: {
  busy?: boolean
  muted?: boolean
  title?: string
  text: string
  onRetry?: () => void
}) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  return (
    <View style={styles.state}>
      {busy ? (
        <ActivityIndicator color={muted ? colors.textSecondary : colors.textPrimary} />
      ) : null}
      {title ? <Text style={styles.stateTitle}>{title}</Text> : null}
      <Text style={styles.stateText}>{text}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('retryLoadingReview')}
        >
          <RefreshCw size={14} color={colors.textPrimary} strokeWidth={2.2} />
          <Text style={styles.retryText}>{t('retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
