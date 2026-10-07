import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsPtBR: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Notificações silenciosas do Dolphin',
  desktopChannelName: 'Notificações do desktop',
  // Delivery preferences
  onlyWhenAway: 'Só quando estiver longe do desktop',
  onlyWhenAwayHint: 'Após 3 minutos sem atividade de teclado ou mouse, ou quando bloqueado.',
  sound: 'Som de notificação',
  suppressWhileFocused: 'Silenciar enquanto estiver vendo',
  suppressWhileFocusedHint: 'Ignora alertas do workspace aberto neste celular.',
  footer:
    'Os tipos de alerta seguem as configurações de notificação de cada desktop pareado. As notificações pausam após 7 dias sem usar este app; abra-o e reconecte para retomar.'
}
