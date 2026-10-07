import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { settingsEn } from './en'

export const settingsEs: MobileLocaleMessages<typeof settingsEn> = {
  back: 'Atrás',
  on: 'Activado',
  off: 'Desactivado',
  retry: 'Reintentar',
  openSettings: 'Abrir Ajustes',

  settings: 'Ajustes',
  terminal: 'Terminal',
  chatUi: 'Chat UI',
  browser: 'Navegador',
  voice: 'Voz',
  notifications: 'Notificaciones',
  backgroundConnection: 'Conexión en segundo plano',
  language: 'Idioma',
  troubleshooting: 'Solución de problemas',
  about: 'Acerca de',
  privacyPolicy: 'Política de privacidad',
  support: 'Soporte',

  languageHeading: 'IDIOMA DE LA APP',
  languageDescription: 'Elige el idioma que usa la app de Dolphin en este dispositivo.',
  languageSystemDefault: 'Predeterminado del sistema',
  languageSaveError: 'No se pudo guardar el idioma. Inténtalo de nuevo.',

  aboutTagline: 'IDE de agentes de código abierto para creadores 100x',
  aboutWebsite: 'Sitio web de Dolphin',
  aboutSourceCode: 'Código fuente de Dolphin',
  aboutOnX: 'Dolphin en X',
  aboutOpenLinkError: 'No se pudo abrir el enlace. Inténtalo de nuevo.',

  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    'Mantiene abierta la conexión del Relay después de salir de la app para que se reabra al instante. Mientras está activado, Android muestra una notificación persistente y aumenta el consumo de batería.',
  backgroundStayConnected: 'Mantener conectado en segundo plano',
  backgroundRetentionOffSubtitle: 'Se desconecta poco después de salir de la app.',
  backgroundRetention15m: '15 minutos',
  backgroundRetention15mSubtitle: 'Permanece conectado 15 minutos en segundo plano.',
  backgroundRetention1h: '1 hora',
  backgroundRetention1hSubtitle: 'Permanece conectado 1 hora en segundo plano.',
  backgroundRetentionAlways: 'Siempre',
  backgroundRetentionAlwaysSubtitle: 'Permanece conectado hasta que lo desactives.',
  backgroundSaveError: 'No se pudo guardar la conexión en segundo plano. Inténtalo de nuevo.',
  backgroundSystemHeading: 'SISTEMA',
  backgroundSystemDescription:
    'El ahorro de batería aún puede cerrar la conexión. Permite que Dolphin se ejecute sin restricciones.',
  backgroundSystemDescriptionWithAutostart:
    'El ahorro de batería aún puede cerrar la conexión. Permite que Dolphin se ejecute sin restricciones y activa el inicio automático.',
  backgroundBatteryOptimization: 'Optimización de batería',
  backgroundUnrestricted: 'Sin restricciones',
  backgroundRestricted: 'Restringido — toca para permitir',
  backgroundAutostart: 'Inicio automático',
  backgroundAutostartHint: 'Necesario en Xiaomi, Redmi y POCO',

  browserLinksHeading: 'ENLACES',
  browserLinksDescription:
    'Elige dónde se abren los enlaces HTTP(S) que tocas en la salida del terminal.',
  browserOpenTerminalLinks: 'Abrir enlaces del terminal',
  browserModeDolphin: 'Navegador de Dolphin en el escritorio',
  browserModeDolphinSubtitle: 'Abre en el navegador transmitido desde tu escritorio vinculado.',
  browserModePhone: 'Navegador del teléfono',
  browserModePhoneSubtitle: 'Abre en Safari, Chrome u otro navegador de este teléfono.',
  browserLoadError: 'No se pudieron cargar las preferencias del navegador. Inténtalo de nuevo.',
  browserSaveError: 'No se pudieron guardar las preferencias del navegador. Inténtalo de nuevo.',

  chatDefaultViewHeading: 'VISTA PREDETERMINADA',
  chatDefaultViewDescription:
    'Elige cómo se abren en este dispositivo las sesiones de agentes compatibles (Claude, Codex y otros agentes con chat). Terminal muestra la CLI sin procesar; Chat UI muestra una interfaz de chat como la de la app de escritorio. Puedes cambiar cualquier sesión individual desde su menú de pulsación larga.',
  chatOpenSessionsInChatUi: 'Abrir sesiones en Chat UI',

  notificationsEnable: 'Activar notificaciones',
  notificationsDefaultDescription:
    'Recibe avisos en este dispositivo cuando un agente necesite tu respuesta o termine una tarea.',
  notificationsPushDescription:
    'Recibe alertas de los agentes incluso con la app cerrada. Se entregan a través del servicio push de Dolphin y de Apple o Google.',
  notificationsBlocked: 'Las notificaciones están desactivadas en los ajustes del sistema.',
  notificationsLoadError:
    'No se pudieron cargar los ajustes de notificaciones. Inténtalo de nuevo.',
  notificationsSaveError:
    'No se pudieron guardar los ajustes de notificaciones. Inténtalo de nuevo.',
  notificationsOpenSettingsError:
    'No se pudieron abrir los ajustes del sistema. Inténtalo de nuevo.',
  deliveryLoadError:
    'No se pudieron cargar los ajustes de entrega. Vuelve a abrir esta pantalla para reintentar.',
  deliverySaveError: 'No se pudieron guardar los ajustes de entrega. Inténtalo de nuevo.',
  deliveryNeedsUpdatedDesktop:
    'Vincula un escritorio actualizado para recibir notificaciones en este teléfono.',

  pushTestHeading: '¿Problemas para recibir alertas?',
  pushTestDetail: 'Envía una prueba a través del servicio push de Dolphin.',
  pushTestSend: 'Enviar notificación de prueba',
  pushTestSending: 'Enviando…',
  pushTestLoadHostsError: 'No se pudieron cargar los escritorios vinculados.',
  pushTestPairDesktop: 'Vincula un escritorio e inténtalo de nuevo.',
  pushTestConnectDesktop: 'Conecta un escritorio e inténtalo de nuevo.',
  pushTestUpdateDesktop: 'Actualiza tu escritorio para ejecutar esta prueba.',
  pushTestReachError: 'No se pudo contactar con el escritorio. Inténtalo de nuevo.',
  pushTestAccepted: 'Aceptada por el servicio push de Dolphin. Comprueba si llegó la notificación.',
  pushTestNotRegistered: 'Vuelve a conectar para registrar este teléfono para notificaciones.',
  pushTestRateLimited: 'Demasiadas notificaciones. Inténtalo más tarde.',
  pushTestSendError: 'No se pudo enviar a través del servicio push de Dolphin. Inténtalo de nuevo.',
  pushTestGenericError: 'No se pudo enviar la prueba push.',

  credentialCleanupTitle: 'Limpieza de credenciales de vinculación',
  credentialCleanupRetryFailed: 'Aún no se pudo confirmar la limpieza. Inténtalo más tarde.',
  credentialCleanupPending: {
    one: 'No se pudo confirmar la limpieza de {count} credencial en este dispositivo.',
    other: 'No se pudo confirmar la limpieza de {count} credenciales en este dispositivo.'
  },
  credentialCleanupUnreadable:
    'No se pudo comprobar el estado de la limpieza en este dispositivo. Reintenta por seguridad.',
  credentialCleanupRetryLabel: 'Reintentar la limpieza de credenciales de vinculación',

  voiceConnectDesktop: 'Conéctate a un escritorio para gestionar los ajustes de voz.',
  voiceLoadError: 'No se pudieron cargar los ajustes de voz.',
  voiceUpdateError: 'No se pudo actualizar.',
  voiceSelectModelError: 'No se pudo seleccionar el modelo.',
  voiceDownloadError: 'Falló la descarga.',
  voiceDeleteError: 'No se pudo eliminar.',
  voiceDictationHeading: 'DICTADO',
  voiceEnableDictation: 'Habilitar dictado de voz',
  voiceEnableDictationDescription: 'Dicta texto en cualquier panel enfocado de tu escritorio.',
  voiceDictationMode: 'Modo de dictado',
  voiceDictationModeDescription:
    'Alternar: pulsa una vez para empezar y otra para parar. Mantener: dicta mientras mantienes pulsado.',
  voiceModeToggle: 'Alternar',
  voiceModeHold: 'Mantener',
  voiceSpeechModelHeading: 'MODELO DE VOZ',
  voiceSpeechModel: 'Modelo de voz',
  voiceNoModelSelected: 'Ninguno seleccionado',

  terminalLeaveHeading: 'AL SALIR DE LA APP',
  terminalLeaveDescription:
    'Mientras usas un terminal en tu teléfono, Dolphin lo reduce para que quepa en tu pantalla. Cuando cierras la app o cambias a otra, esto controla si se queda al tamaño del teléfono (para que las herramientas de CLI interactivas no se reajusten) o vuelve al tamaño de tu escritorio. Siempre puedes usar Restaurar este terminal o Restaurar todos los terminales en el banner para redimensionarlo manualmente.',
  terminalNoHosts:
    'Aún no hay escritorios vinculados. Vincula uno para controlar el comportamiento del terminal.',
  terminalRestoreKeepPhoneSize: 'Mantener al tamaño del teléfono (predeterminado)',
  terminalRestoreAfter1Minute: 'Después de 1 minuto',
  terminalRestoreAfter5Minutes: 'Después de 5 minutos',
  terminalRestoreAfter30Minutes: 'Después de 30 minutos',
  terminalRestoreAfterSeconds: 'Después de {seconds} s',
  terminalRestorePickerTitle: 'Restaurar {host}',
  terminalTextSizeHeading: 'TAMAÑO DEL TEXTO',
  terminalTextSizeDescription:
    'Escala el texto del terminal. Los tamaños pequeños muestran más columnas con márgenes laterales; los grandes muestran menos columnas — arrastra hacia los lados para desplazarte. También puedes pellizcar para hacer zoom en el propio terminal, lo que actualiza este ajuste. Solo afecta a la visualización en este dispositivo; no cambia el terminal del escritorio.',
  terminalTextSize: 'Tamaño del texto',
  terminalTextSizePickerTitle: 'Tamaño del texto del terminal',
  terminalTextSizeSmallest: 'Mínimo (50 %)',
  terminalTextSizeSmaller: 'Más pequeño (75 %)',
  terminalTextSizeDefault: 'Predeterminado (100 %)',
  terminalTextSizeLarge: 'Grande (125 %)',
  terminalTextSizeLarger: 'Más grande (150 %)',
  terminalTextSizeLargest: 'Máximo (200 %)',
  terminalKeyboardHeading: 'ENTRADA DE TECLADO',
  terminalKeyboardDescription:
    'Activa el autocompletado, la autocorrección y las sugerencias ortográficas del teléfono en la barra de comandos del terminal. Desactivado por defecto para que el teclado nunca reescriba comandos, flags ni rutas. La entrada directa de teclado (cuando las teclas van directamente al terminal) siempre envía las pulsaciones sin procesar, así que las sugerencias no se aplican.',
  terminalAutocomplete: 'Autocompletado y autocorrección'
}
