import { Pressable, View } from 'react-native'
import { SquareChevronRight } from 'lucide-react-native'

import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-session-styles'
import { sessionCatalog } from '../i18n/catalogs/session'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Props = {
  disabled: boolean
  onPress: () => void
}

export function QuickCommandsTabButton({ disabled, onPress }: Props) {
  const t = useMobileTranslation(sessionCatalog)
  return (
    <>
      <View style={styles.tabActionDivider} />
      <Pressable
        style={({ pressed }) => [
          styles.newTerminalButton,
          pressed && styles.newTerminalButtonPressed,
          disabled && styles.newTerminalButtonDisabled
        ]}
        disabled={disabled}
        onPress={onPress}
        accessibilityLabel={t('quickCommandsAccessibility')}
      >
        <SquareChevronRight size={16} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>
    </>
  )
}
