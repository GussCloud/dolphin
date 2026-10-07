import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homeEs: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: 'Inténtalo de nuevo.',
  remove: 'Quitar',
  update: 'Actualizar',
  tasks: 'Tareas',
  openSettings: 'Abrir ajustes',
  // Host actions
  checkPairingErrorTitle: 'No se pudo comprobar la vinculación',
  removeHostErrorTitle: 'No se pudo quitar el host',
  removeHostTitle: 'Quitar host',
  removeHostMessage: '¿Quitar "{name}"? Puedes volver a vincularlo más tarde.',
  updateDesktopTitle: 'Actualizar escritorio',
  // Empty state
  emptyTitle: 'Conecta tu escritorio',
  emptyBody:
    'Vincula Dolphin en tu ordenador para supervisar tus agentes, entrar en cualquier terminal y dirigir el trabajo desde tu teléfono.',
  pairDesktop: 'Vincular escritorio',
  howItWorks: 'Cómo funciona',
  stepOpenDesktopTitle: 'Abre Dolphin en el escritorio',
  stepOpenDesktopDesc: 'Ve a Ajustes → Móvil y genera un código QR de vinculación.',
  stepScanTitle: 'Escanea el código',
  stepScanDesc:
    'Toca el botón de arriba para abrir el escáner. Apunta al código QR de tu pantalla.',
  stepConnectedTitle: 'Ya estás conectado',
  stepConnectedDesc: 'Tu escritorio aparecerá aquí. Todo está cifrado de extremo a extremo.',
  // List header and footer
  welcomeBack: 'Hola de nuevo',
  statAgentsSpawned: 'Agentes iniciados',
  statAgentTime: 'Tiempo de agentes',
  statPRsCreated: 'PR creados',
  durationDaysHours: '{days} d {hours} h',
  durationHoursMinutes: '{hours} h {minutes} min',
  durationMinutes: '{minutes} min',
  desktops: 'Escritorios',
  resume: 'Continuar',
  accountUsage: 'Uso de la cuenta',
  systemDefaultAccount: 'Predeterminado del sistema',
  noTaskSources: 'No hay fuentes de tareas conectadas',
  openProviderTasks: 'Abrir tareas de {provider}'
}
