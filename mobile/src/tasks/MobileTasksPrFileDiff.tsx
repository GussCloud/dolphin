import {
  type GitHubPrFileDiffLine,
  type ReactNode,
  useMemo,
  buildGitHubPrFileDiffPreview,
  resolveMobileSyntaxLanguage,
  highlightMobileDiffLines,
  Text,
  View,
  MobileSyntaxSegments,
  TextInput,
  colors,
  Pressable
} from './mobile-tasks-dependencies'
import { MAX_RENDERED_PR_DIFF_LINES } from './mobile-tasks-options'
import type { GitHubPRFileContents } from './mobile-tasks-provider-detail-types'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'

export function formatDiffLineNumber(value: number | undefined): string {
  return value === undefined ? '    ' : value.toString().padStart(4, ' ')
}

export function diffLinePrefix(kind: GitHubPrFileDiffLine['kind']): string {
  if (kind === 'added') {
    return '+'
  }
  if (kind === 'removed') {
    return '-'
  }
  return ' '
}

export function GitHubPrFileDiff({
  filePath,
  contents,
  commentDrafts,
  disabled,
  onCommentDraftChange,
  onSubmitComment
}: {
  filePath: string
  contents: GitHubPRFileContents
  commentDrafts: Record<string, string>
  disabled: boolean
  onCommentDraftChange: (key: string, value: string) => void
  onSubmitComment: (line: number) => void
}): ReactNode {
  const diffPreview = useMemo(
    () =>
      buildGitHubPrFileDiffPreview(
        contents.original,
        contents.modified,
        MAX_RENDERED_PR_DIFF_LINES
      ),
    [contents.modified, contents.original]
  )
  const syntaxLanguage = useMemo(() => resolveMobileSyntaxLanguage(filePath), [filePath])
  const visibleDiffLines = useMemo(
    () => highlightMobileDiffLines(diffPreview.lines, syntaxLanguage),
    [diffPreview.lines, syntaxLanguage]
  )
  const hiddenDiffLineCount = Math.max(0, diffPreview.totalLineCount - visibleDiffLines.length)

  if (diffPreview.totalLineCount === 0) {
    return <Text style={styles.detailMuted}>{t('noTextChanges')}</Text>
  }

  return (
    <View style={styles.fileDiff}>
      {hiddenDiffLineCount > 0 ? (
        <Text style={styles.detailMuted}>
          {t('diffTruncated', {
            shown: MAX_RENDERED_PR_DIFF_LINES,
            total: diffPreview.totalLineCount
          })}
        </Text>
      ) : null}
      {visibleDiffLines.map((line) => {
        const commentLine = line.kind === 'removed' ? undefined : line.newLineNumber
        const draftKey = commentLine === undefined ? '' : `${filePath}:${commentLine}`
        return (
          <View
            key={line.key}
            style={[
              styles.diffLineBlock,
              line.kind === 'added'
                ? styles.diffLineAdded
                : line.kind === 'removed'
                  ? styles.diffLineRemoved
                  : null
            ]}
          >
            <View style={styles.diffCodeRow}>
              <Text style={styles.diffLineNumbers}>
                {formatDiffLineNumber(line.oldLineNumber)}{' '}
                {formatDiffLineNumber(line.newLineNumber)}
              </Text>
              <Text
                style={[
                  styles.codeLine,
                  line.kind === 'added'
                    ? styles.diffCodeAdded
                    : line.kind === 'removed'
                      ? styles.diffCodeRemoved
                      : null
                ]}
              >
                <Text>{diffLinePrefix(line.kind)} </Text>
                <MobileSyntaxSegments segments={line.segments} />
                {line.text ? null : ' '}
              </Text>
            </View>
            {commentLine !== undefined ? (
              <>
                <TextInput
                  style={[styles.input, styles.replyInput]}
                  value={commentDrafts[draftKey] ?? ''}
                  onChangeText={(next) => onCommentDraftChange(draftKey, next)}
                  placeholder={t('addReviewCommentPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  style={styles.inlineSaveButtonCompact}
                  disabled={disabled || !(commentDrafts[draftKey] ?? '').trim()}
                  onPress={() => onSubmitComment(commentLine)}
                >
                  <Text style={styles.inlineSaveText}>
                    {t('commentOnLine', { line: commentLine })}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
