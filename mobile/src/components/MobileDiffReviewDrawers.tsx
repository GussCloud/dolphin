import { useMemo } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { Check, Copy, FileText, Plus, Send, Trash2, X } from 'lucide-react-native'
import type { DiffComment } from '../../../src/shared/diff-comment-types'
import { useKeyboardAvoidingPadding } from '../platform/keyboard-occlusion'
import { colors } from '../theme/mobile-theme'
import { componentsDiffReviewCatalog } from '../i18n/catalogs/components-diff-review'
import type { componentsDiffReviewEn } from '../i18n/catalogs/components-diff-review/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import type { ActionSheetAction } from './ActionSheetModal'
import { ActionSheetModal } from './ActionSheetModal'
import { BottomDrawer } from './BottomDrawer'
import { ConfirmModal } from './ConfirmModal'
import type { useMobileDiffReviewController } from '../session/use-mobile-diff-review-controller'
import { mobileDiffReviewStyles as styles } from './mobile-diff-review-screen-styles'

type Props = {
  controller: ReturnType<typeof useMobileDiffReviewController>
}

type DiffReviewTranslate = MobileTranslate<typeof componentsDiffReviewEn>

export function MobileDiffReviewDrawers({ controller }: Props) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  const sendActions = useSendActions(controller, t)
  const overflowActions = useOverflowActions(controller, t)
  return (
    <>
      <ActionSheetModal
        visible={controller.showOverflow}
        title={t('reviewActions')}
        message={
          controller.reviewedUnstagedCount > 0
            ? t('reviewedUnstagedCanBeStaged', { count: controller.reviewedUnstagedCount })
            : undefined
        }
        actions={overflowActions}
        onClose={() => controller.setShowOverflow(false)}
      />
      <ActionSheetModal
        visible={controller.sendSheet !== null}
        title={t('sendNotes')}
        message={sendSheetMessage(controller, t)}
        actions={sendActions}
        onClose={() => controller.setSendSheet(null)}
      />
      <ConfirmModal
        visible={controller.discardTarget !== null}
        title={t('discardFile')}
        message={
          controller.discardTarget
            ? t('discardFileMessage', { path: controller.discardTarget.filePath })
            : undefined
        }
        confirmLabel={t('discard')}
        destructive
        onConfirm={() => {
          const target = controller.discardTarget
          controller.setDiscardTarget(null)
          if (target) {
            void controller.runGitMutation('git.discard', target)
          }
        }}
        onCancel={() => controller.setDiscardTarget(null)}
      />
      <NoteComposerDrawer controller={controller} />
      <CompletionDrawer controller={controller} />
    </>
  )
}

function useSendActions(
  controller: ReturnType<typeof useMobileDiffReviewController>,
  t: DiffReviewTranslate
) {
  return useMemo<ActionSheetAction[]>(() => {
    const comments = controller.unsentComments
    const terminalActions =
      controller.sendSheet?.kind === 'ready' || controller.sendSheet?.kind === 'error'
        ? controller.sendSheet.terminals.map((terminal) => ({
            label: `${terminal.title || t('terminal')} (${terminal.terminal.slice(0, 6)})`,
            icon: Send,
            disabled: comments.length === 0,
            skipAutoClose: true,
            onPress: () => void controller.sendPromptToTerminal(terminal.terminal, comments)
          }))
        : []
    return [
      ...terminalActions,
      {
        label: t('newAgentSession'),
        icon: Plus,
        disabled: comments.length === 0,
        skipAutoClose: true,
        onPress: () => void controller.createTerminalAndSend(comments)
      },
      {
        label: t('copyNotes'),
        icon: Copy,
        disabled:
          controller.screenState.kind !== 'ready' || controller.screenState.comments.length === 0,
        onPress: () => void controller.copyNotes()
      }
    ]
  }, [controller, t])
}

function useOverflowActions(
  controller: ReturnType<typeof useMobileDiffReviewController>,
  t: DiffReviewTranslate
) {
  return useMemo<ActionSheetAction[]>(
    () => [
      {
        label: t('copyNotes'),
        icon: Copy,
        disabled:
          controller.screenState.kind !== 'ready' || controller.screenState.comments.length === 0,
        onPress: () => void controller.copyNotes()
      },
      {
        label: t('sendUnsentNotes'),
        icon: Send,
        disabled: controller.unsentComments.length === 0,
        skipAutoClose: true,
        onPress: () => void controller.openSendSheet()
      },
      {
        label: t('clearSentNotes'),
        icon: Trash2,
        disabled:
          controller.screenState.kind !== 'ready' ||
          controller.screenState.comments.every((comment) => comment.sentAt === undefined),
        skipAutoClose: true,
        onPress: () => void controller.clearSentNotes()
      },
      {
        label: t('stageReviewedFiles'),
        icon: Check,
        disabled: controller.reviewedUnstagedCount === 0 || controller.busyAction !== null,
        skipAutoClose: true,
        onPress: () => void controller.stageReviewedFiles()
      },
      {
        label: t('markUnreviewed'),
        icon: X,
        disabled:
          controller.screenState.kind !== 'ready' ||
          !controller.currentItem ||
          !controller.currentItem.isReviewed,
        skipAutoClose: true,
        onPress: () => void controller.markUnreviewed()
      },
      {
        label: t('openInSession'),
        icon: FileText,
        disabled: !controller.currentItem || controller.currentItem.scope === 'branch',
        onPress: () => void controller.openInSession()
      }
    ],
    [controller, t]
  )
}

function sendSheetMessage(
  controller: ReturnType<typeof useMobileDiffReviewController>,
  t: DiffReviewTranslate
): string | undefined {
  return controller.sendSheet?.kind === 'loading'
    ? t('loadingAgentSessions')
    : controller.sendSheet?.kind === 'error'
      ? controller.sendSheet.message
      : t('unsentNotesCount', { count: controller.unsentComments.length })
}

function NoteComposerDrawer({ controller }: Props) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  const composer = controller.composer
  // Zero on a phone, where `KeyboardAvoidingView` above already moved this; the page's own
  // keyboard measurement where it cannot, because that view is driven by events RN Web never
  // sends. Padding rather than a second avoiding view: the drawer owns the position.
  const keyboardPadding = useKeyboardAvoidingPadding()
  return (
    <BottomDrawer visible={composer !== null} onClose={controller.closeComposer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={keyboardPadding > 0 ? { paddingBottom: keyboardPadding } : undefined}
      >
        <View style={styles.composerHeader}>
          <View>
            <Text style={styles.drawerTitle}>
              {composer?.mode === 'edit' ? t('editNote') : t('addNote')}
            </Text>
            <Text style={styles.drawerSubtitle}>
              {composer?.mode === 'create' && composer.lineNumber > 0
                ? t('lineNumber', { line: composer.lineNumber })
                : t('fileNote')}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={controller.closeComposer}
            accessibilityRole="button"
            accessibilityLabel={t('cancelNote')}
          >
            <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>
        <TextInput
          style={styles.composerInput}
          value={controller.composerBody}
          onChangeText={controller.setComposerBody}
          multiline
          autoFocus
          placeholder={t('reviewNote')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={composerLabel(composer, t)}
        />
        <View style={styles.drawerButtonRow}>
          {composer?.mode === 'edit' ? (
            <DeleteNoteButton onPress={controller.deleteComment} />
          ) : null}
          <SaveNoteButton controller={controller} composer={composer} />
        </View>
      </KeyboardAvoidingView>
    </BottomDrawer>
  )
}

function composerLabel(
  composer: { mode: 'create'; lineNumber: number } | { mode: 'edit'; comment: DiffComment } | null,
  t: DiffReviewTranslate
): string {
  return composer?.mode === 'create' && composer.lineNumber > 0
    ? t('saveNoteOnLine', { line: composer.lineNumber })
    : t('reviewNote')
}

function DeleteNoteButton({ onPress }: { onPress: () => Promise<void> }) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  return (
    <Pressable
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityLabel={t('deleteNote')}
    >
      <Trash2 size={14} color={colors.statusRed} strokeWidth={2.2} />
      <Text style={styles.destructiveText}>{t('delete')}</Text>
    </Pressable>
  )
}

function SaveNoteButton({
  controller,
  composer
}: {
  controller: ReturnType<typeof useMobileDiffReviewController>
  composer: ReturnType<typeof useMobileDiffReviewController>['composer']
}) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  const disabled = controller.composerBody.trim().length === 0
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed
      ]}
      disabled={disabled}
      onPress={() => void controller.saveComposer()}
      accessibilityRole="button"
      accessibilityLabel={composerLabel(composer, t)}
    >
      <Check size={14} color={colors.bgBase} strokeWidth={2.2} />
      <Text style={styles.primaryButtonText}>{t('save')}</Text>
    </Pressable>
  )
}

function CompletionDrawer({ controller }: Props) {
  const t = useMobileTranslation(componentsDiffReviewCatalog)
  const noteCount =
    controller.screenState.kind === 'ready' ? controller.screenState.comments.length : 0
  return (
    <BottomDrawer
      visible={controller.showCompletion}
      onClose={() => controller.setShowCompletion(false)}
    >
      <Text style={styles.drawerTitle}>{t('reviewComplete')}</Text>
      <Text style={styles.drawerSubtitle}>
        {t('reviewCompleteSummary', {
          files: t('filesCount', { count: controller.queue.length }),
          notes: t('notesCount', { count: noteCount })
        })}
      </Text>
      <View style={styles.drawerButtonRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          disabled={controller.reviewedUnstagedCount === 0}
          onPress={() => void controller.stageReviewedFiles()}
          accessibilityRole="button"
          accessibilityLabel={t('stageReviewedFilesLabel')}
        >
          <Check size={14} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.secondaryButtonText}>{t('stageReviewed')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          disabled={controller.unsentComments.length === 0}
          onPress={() => void controller.openSendSheet()}
          accessibilityRole="button"
          accessibilityLabel={t('sendNotesToAgent')}
        >
          <Send size={14} color={colors.bgBase} strokeWidth={2.2} />
          <Text style={styles.primaryButtonText}>{t('sendNotes')}</Text>
        </Pressable>
      </View>
    </BottomDrawer>
  )
}
