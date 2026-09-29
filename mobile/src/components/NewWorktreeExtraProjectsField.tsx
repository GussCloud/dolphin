import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Plus, X } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  getMobileWorkspaceRepoBadgeColor,
  type MobileWorkspaceRepo
} from './new-worktree-modal-types'

/** The projects added next to the primary one; each gets its own worktree in one workspace. */
export function NewWorktreeExtraProjectsField(props: {
  extraRepos: readonly MobileWorkspaceRepo[]
  canAddMore: boolean
  disabled: boolean
  onAdd: () => void
  onRemove: (repoId: string) => void
}) {
  return (
    <View style={styles.field}>
      {props.extraRepos.length > 0 ? (
        <View style={styles.chips}>
          {props.extraRepos.map((repo) => (
            <View key={repo.id} style={styles.chip}>
              <View
                style={[styles.dot, { backgroundColor: getMobileWorkspaceRepoBadgeColor(repo) }]}
              />
              <Text style={styles.chipText} numberOfLines={1}>
                {repo.displayName}
              </Text>
              <Pressable
                accessibilityLabel={`Remove ${repo.displayName}`}
                hitSlop={8}
                disabled={props.disabled}
                onPress={() => props.onRemove(repo.id)}
              >
                <X size={12} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {props.canAddMore ? (
        <Pressable
          style={[styles.addButton, props.disabled && styles.disabled]}
          disabled={props.disabled}
          onPress={props.onAdd}
        >
          <Plus size={14} color={colors.textSecondary} />
          <Text style={styles.addText}>Add another project</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    backgroundColor: colors.bgRaised,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999
  },
  chipText: {
    flexShrink: 1,
    fontSize: typography.metaSize,
    color: colors.textPrimary
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs
  },
  addText: {
    fontSize: typography.metaSize,
    color: colors.textSecondary
  },
  disabled: {
    opacity: 0.55
  }
})
