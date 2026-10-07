import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsEs: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Notificaciones silenciosas de Dolphin',
  desktopChannelName: 'Notificaciones del escritorio',
  // Delivery preferences
  onlyWhenAway: 'Solo cuando no estés en el escritorio',
  onlyWhenAwayHint:
    'Tras 3 minutos sin actividad del teclado o del ratón, o cuando esté bloqueado.',
  sound: 'Sonido de notificación',
  suppressWhileFocused: 'Silenciar mientras lo estés viendo',
  suppressWhileFocusedHint: 'Omite los avisos del espacio de trabajo abierto en este teléfono.',
  footer:
    'Los tipos de aviso siguen la configuración de notificaciones de cada escritorio vinculado. Las notificaciones se pausan tras 7 días sin usar esta app; ábrela y vuelve a conectarte para reanudarlas.'
}
