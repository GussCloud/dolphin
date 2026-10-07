import { Pressable, Switch, Text, View } from 'react-native'
import type { WorkspaceCreateSetupDecision } from '../tasks/workspace-create-params'
import { colors } from '../theme/mobile-theme'
import { newWorktreeFormStyles as styles } from './new-worktree-form-styles'
import type { SetupRunPolicy } from './new-worktree-modal-types'
import { componentsNewWorkspaceCatalog } from '../i18n/catalogs/components-new-workspace'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function NewWorkspaceSetupScriptField({
  command,
  source,
  runPolicy,
  decision,
  runSetup,
  onDecisionChange,
  onRunSetupChange
}: {
  command: string
  source: string | null
  runPolicy: SetupRunPolicy
  decision: Exclude<WorkspaceCreateSetupDecision, 'inherit'> | null
  runSetup: boolean
  onDecisionChange: (decision: Exclude<WorkspaceCreateSetupDecision, 'inherit'>) => void
  onRunSetupChange: (run: boolean) => void
}) {
  const t = useMobileTranslation(componentsNewWorkspaceCatalog)
  return (
    <View style={styles.field}>
      <View style={styles.setupHeader}>
        <Text style={styles.label}>{t('setupScript')}</Text>
        {source ? (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>
              {source === 'dolphin.yaml' ? 'DOLPHIN.YAML' : 'HOOKS'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.setupBox}>
        {runPolicy === 'ask' ? (
          <View style={styles.setupChoiceRow}>
            <Pressable
              style={[
                styles.setupChoiceButton,
                decision === 'run' && styles.setupChoiceButtonSelected
              ]}
              onPress={() => onDecisionChange('run')}
            >
              <Text style={styles.setupChoiceText}>{t('run')}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.setupChoiceButton,
                decision === 'skip' && styles.setupChoiceButtonSelected
              ]}
              onPress={() => onDecisionChange('skip')}
            >
              <Text style={styles.setupChoiceText}>{t('skip')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.setupToggleRow}>
            <Text style={styles.setupToggleLabel}>{t('runSetupCommand')}</Text>
            <Switch
              value={runSetup}
              onValueChange={onRunSetupChange}
              trackColor={{ false: colors.borderSubtle, true: colors.textSecondary }}
              thumbColor={colors.textPrimary}
              style={styles.setupSwitch}
            />
          </View>
        )}
        <View style={styles.setupCommandBlock}>
          <Text style={styles.setupCommand}>{command}</Text>
        </View>
      </View>
    </View>
  )
}
