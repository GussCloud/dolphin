import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingEs: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: '¿Cómo deben abrirse las sesiones?',
  sessionViewBody:
    'Elige si las sesiones de agentes compatibles se abren en la terminal o en Chat UI en este dispositivo. Mantén pulsada una pestaña de sesión para cambiar su vista o cambia el valor predeterminado más tarde en Ajustes.',
  useChatUi: 'Usar Chat UI',
  useChatUiA11y: 'Abrir sesiones en Chat UI',
  keepTerminal: 'Mantener terminal',
  keepTerminalA11y: 'Abrir sesiones en la terminal',
  // Notifications step
  notificationsTitle: 'No te pierdas cuándo un agente te necesita',
  notificationsBody:
    'Recibe una notificación en este teléfono cuando un agente termine o esté esperando, aunque no estés usando la app.',
  notificationsDisclosure:
    'Se envían a través del servicio push de Dolphin cuando tu escritorio lleva 3 minutos inactivo. Cámbialo cuando quieras en Ajustes.',
  enableNotifications: 'Activar notificaciones',
  enableNotificationsA11y: 'Activar notificaciones de agentes',
  notNow: 'Ahora no',
  notNowA11y: 'Omitir las notificaciones por ahora',
  // Sample notification banners
  sampleNow: 'ahora',
  sampleCodexTitle: 'Codex terminó',
  sampleCodexBody: 'Las pruebas pasan.',
  sampleClaudeTitle: 'Claude necesita tu respuesta',
  sampleClaudeBody: 'Te está esperando.'
}
