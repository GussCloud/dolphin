import { ListChecks } from 'lucide-react-native'
import { MobileAgentSessionHistoryIcon } from '../agent-history/MobileAgentSessionHistoryIcon'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { colors } from '../theme/mobile-theme'
import { sessionCatalog } from '../i18n/catalogs/session'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Props = {
  visible: boolean
  showAgentSessionHistory: boolean
  showChecks: boolean
  onOpenAgentSessionHistory: () => void
  onOpenChecks: () => void
  onClose: () => void
}

export function MobileSessionHeaderMoreActionsSheet({
  visible,
  showAgentSessionHistory,
  showChecks,
  onOpenAgentSessionHistory,
  onOpenChecks,
  onClose
}: Props) {
  const t = useMobileTranslation(sessionCatalog)
  return (
    <ActionSheetModal
      visible={visible}
      actions={[
        ...(showAgentSessionHistory
          ? [
              {
                label: t('agentHistory'),
                hint: t('agentHistoryHint'),
                renderIcon: () => (
                  <MobileAgentSessionHistoryIcon
                    size={16}
                    color={colors.textSecondary}
                    strokeWidth={2.1}
                  />
                ),
                onPress: onOpenAgentSessionHistory
              }
            ]
          : []),
        ...(showChecks
          ? [
              {
                label: t('checks'),
                hint: t('checksHint'),
                icon: ListChecks,
                onPress: onOpenChecks
              }
            ]
          : [])
      ]}
      onClose={onClose}
    />
  )
}
