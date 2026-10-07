import { memo, type ComponentType } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import {
  Bold,
  Code2,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
  Strikethrough
} from 'lucide-react-native'
import { colors, radii, spacing } from '../theme/mobile-theme'
import type { MobileRichMarkdownCommand } from './mobile-rich-markdown-editor-contract'
import { componentsCatalog } from '../i18n/catalogs/components'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type ToolbarItem = {
  command: MobileRichMarkdownCommand
  labelKey: string
  icon: ComponentType<{ size?: number; color?: string }>
}

/**
 * The fifteen commands, in the order they are pressed in.
 *
 * Shared rather than declared twice because both surfaces drive the same document: inside the
 * WebView the press becomes an injected `runCommand` and on the page it is a call, but the row of
 * controls is the same row and a command added to the contract has to appear on both.
 */
const TOOLBAR_ITEMS = [
  { command: 'paragraph', labelKey: 'toolbarBody', icon: Pilcrow },
  { command: 'heading1', labelKey: 'toolbarHeading1', icon: Heading1 },
  { command: 'heading2', labelKey: 'toolbarHeading2', icon: Heading2 },
  { command: 'heading3', labelKey: 'toolbarHeading3', icon: Heading3 },
  { command: 'bold', labelKey: 'toolbarBold', icon: Bold },
  { command: 'italic', labelKey: 'toolbarItalic', icon: Italic },
  { command: 'strike', labelKey: 'toolbarStrike', icon: Strikethrough },
  { command: 'bulletList', labelKey: 'toolbarBulletList', icon: List },
  { command: 'orderedList', labelKey: 'toolbarNumberedList', icon: ListOrdered },
  { command: 'taskList', labelKey: 'toolbarChecklist', icon: ListTodo },
  { command: 'quote', labelKey: 'toolbarQuote', icon: Quote },
  { command: 'link', labelKey: 'toolbarLink', icon: Link },
  { command: 'image', labelKey: 'toolbarImage', icon: ImageIcon },
  { command: 'inlineCode', labelKey: 'toolbarInlineCode', icon: Code2 },
  { command: 'codeBlock', labelKey: 'toolbarCodeBlock', icon: FileCode2 }
] as const satisfies readonly ToolbarItem[]

/** The commands alone, for a caller that drives the row rather than renders it. */
export const MOBILE_RICH_MARKDOWN_TOOLBAR_COMMANDS = TOOLBAR_ITEMS.map((item) => item.command)

export const MobileRichMarkdownToolbar = memo(function MobileRichMarkdownToolbar({
  editable,
  onCommand
}: {
  editable: boolean
  onCommand: (command: MobileRichMarkdownCommand) => void
}) {
  const t = useMobileTranslation(componentsCatalog)
  return (
    <View style={styles.toolbar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarContent}
        keyboardShouldPersistTaps="handled"
      >
        {TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Pressable
              key={item.command}
              disabled={!editable}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              onPress={() => onCommand(item.command)}
              style={({ pressed }) => [
                styles.toolbarButton,
                pressed && editable ? styles.toolbarButtonPressed : null,
                !editable ? styles.toolbarButtonDisabled : null
              ]}
            >
              <Icon size={15} color={editable ? colors.textPrimary : colors.textMuted} />
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  toolbar: {
    minHeight: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  toolbarContent: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  toolbarButton: {
    minWidth: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    paddingHorizontal: spacing.xs
  },
  toolbarButtonPressed: {
    backgroundColor: colors.bgRaised
  },
  toolbarButtonDisabled: {
    opacity: 0.55
  }
})
