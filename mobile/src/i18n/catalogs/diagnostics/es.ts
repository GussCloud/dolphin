import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { diagnosticsEn } from './en'

export const diagnosticsEs: MobileLocaleMessages<typeof diagnosticsEn> = {
  // Shared chrome
  back: 'Atrás',
  troubleshooting: 'Solución de problemas',
  networkDiagnostics: 'Diagnóstico de red',
  // Troubleshoot screen
  running: 'Ejecutando…',
  runAgain: 'Ejecutar de nuevo',
  runDiagnostics: 'Ejecutar diagnóstico',
  viewNetworkDiagnostics: 'Ver diagnóstico de red',
  commonIssues: 'Problemas frecuentes',
  // Diagnostic checks
  checkPairedHosts: 'Hosts vinculados',
  checkPairedCount: { one: '{count} vinculado', other: '{count} vinculados' },
  checkPairedNone: 'Ninguno: escanea un QR para vincular',
  checkPairedReadError: 'No se pudieron leer los datos del host',
  checkInternet: 'Internet',
  checkInternetConnected: 'Conectado',
  checkInternetUnexpected: 'Respuesta inesperada',
  checkInternetNone: 'Sin conexión',
  checkReachableAt: 'Accesible en {endpoint}',
  checkHosts: 'Hosts',
  checkHostsError: 'No se pudo probar',
  checkPlatform: 'Plataforma',
  cannotReach: 'No se puede acceder a {endpoint}',
  cannotReachTailscale: 'No se puede acceder a {endpoint}: revisa Tailscale',
  // Common issues: push notifications
  notifTitle: 'Notificaciones push',
  notifStep1:
    'Comprueba que los ajustes del sistema permiten las notificaciones de Dolphin y que Concentración o No molestar están desactivados.',
  notifStep2:
    'Prueba con datos móviles u otra red Wi-Fi. Si los avisos llegan tras cambiar, tu red puede estar retrasando la entrega.',
  // Common issues: different Wi-Fi
  wifiTitle: 'Redes Wi-Fi distintas',
  wifiStep1:
    'Ambos dispositivos deben estar en la misma LAN (salvo que se conecten mediante Tailscale).',
  wifiStep2: 'Ethernet y Wi-Fi deben compartir la misma subred.',
  wifiStep3: 'Prueba a reconectar el Wi-Fi en ambos dispositivos.',
  // Common issues: firewall
  firewallTitle: 'El firewall bloquea el puerto 6768',
  firewallStep1: 'macOS: Ajustes del Sistema → Red → Firewall: permite Dolphin.',
  firewallStep2:
    'Windows: Firewall de Defender → Permitir una aplicación: habilita Dolphin para redes privadas.',
  firewallStep3: 'Linux: sudo ufw allow 6768',
  firewallStep4:
    'Las redes corporativas o escolares pueden bloquear P2P: prueba con un punto de acceso personal.',
  // Common issues: desktop not running
  desktopTitle: 'La app de escritorio no se está ejecutando',
  desktopStep1: 'Dolphin debe estar abierto en tu escritorio para aceptar conexiones.',
  desktopStep2: 'Prueba a reiniciar Dolphin: el servidor complementario se inicia al abrirlo.',
  desktopStep3: 'Tras una actualización, puede que tengas que volver a vincular con el código QR.',
  // Common issues: timeout
  timeoutTitle: 'Tiempo de conexión agotado',
  timeoutStep1: 'Comprueba la intensidad de la señal Wi-Fi en tu teléfono.',
  timeoutStep2: 'Vuelve a la lista de hosts y toca tu host para reintentar.',
  timeoutStep3: 'Reinicia ambas apps si los tiempos de espera continúan.',
  // Common issues: Tailscale
  tailscaleTitle: 'Host de Tailscale inaccesible',
  tailscaleStep1:
    'Las direcciones como 100.x.x.x o *.ts.net se conectan mediante Tailscale: mantenlo activado.',
  tailscaleStep2:
    'iOS/Android pueden bloquear el túnel sin avisar: desactiva y vuelve a activar Tailscale en su app.',
  tailscaleStep3: 'Comprueba que el escritorio esté activo y aparezca conectado en tu tailnet.',
  tailscaleStep4:
    'Actualiza la app de Tailscale: las versiones recientes corrigen fallos de reconexión.',
  // Common issues: other VPNs
  vpnTitle: 'Interferencia de otras VPN',
  vpnStep1:
    'Las VPN que no son Tailscale pueden enviar el tráfico local a través de un servidor remoto.',
  vpnStep2: 'Desactiva esa VPN o activa el túnel dividido / "Permitir LAN".',
  // Network diagnostics screen
  stateConnecting: 'Conectando',
  stateHandshaking: 'Negociando',
  stateConnected: 'Conectado',
  stateDisconnected: 'Desconectado',
  stateReconnecting: 'Reconectando',
  stateAuthFailed: 'Error de autenticación',
  stateWithAttempt: '{state} · intento {attempt}',
  copied: 'Copiado',
  copyReport: 'Copiar informe',
  whatThisSuggests: 'Qué indica esto',
  sendPrivacyHint:
    'Envía un informe limitado y anonimizado con el nombre del host, el endpoint, las versiones, el estado de la conexión y los eventos; nunca el contenido de la terminal ni credenciales.',
  sending: 'Enviando…',
  diagnosticsSent: 'Diagnóstico enviado',
  retrySending: 'Reintentar el envío',
  sendDiagnostics: 'Enviar diagnóstico a Dolphin',
  noEvents: 'Aún no hay eventos de conexión. Aparecerán cuando la app contacte con este host.',
  noPairedHosts: 'No hay hosts vinculados.',
  // Connection diagnosis (the shareable report renders these in English)
  causeHealthy: 'La conexión funciona correctamente.',
  causeHealthyVia: 'La conexión funciona correctamente a través de {path}.',
  nextNoAction: 'No hace falta hacer nada.',
  pathTailscaleDirect: 'Tailscale/directa',
  pathLanDirect: 'LAN/directa',
  causeBeforeNetworkChange: 'Antes del último cambio de red: {cause}',
  causeBeforeResume: 'Antes de que la app se reanudara por última vez: {cause}',
  causeRelayCredentialRejected: 'Relay rechazó la credencial de reanudación guardada.',
  nextRelayCredentialRejected:
    'Prueba una conexión directa; si Relay sigue devolviendo 401, vuelve a vincular este dispositivo.',
  causeRelayUnavailable: 'El servicio Relay no estaba disponible temporalmente.',
  causeRelayUnavailableRetry:
    'El servicio Relay no estaba disponible temporalmente y pidió a Dolphin reintentar en {delay}.',
  nextRelayUnavailable:
    'Mantén Dolphin abierto; la recuperación debería reintentarse automáticamente.',
  delaySeconds: '{seconds} s',
  delayMinutes: '{minutes} min',
  causeRelayLiveness: 'Relay dejó de responder a las comprobaciones de estado autenticadas.',
  causeHostLiveness:
    'El host conectado dejó de responder a las comprobaciones de estado autenticadas.',
  nextLiveness: 'Dolphin cerró la sesión obsoleta e inició la recuperación.',
  causeRelaySessionFailed: 'La sesión activa de Relay se cerró inesperadamente.',
  nextRelaySessionFailed:
    'Dolphin inició la recuperación de Relay; el historial de eventos incluye el motivo de cierre de la celda.',
  causeAuthRejected: 'El escritorio rechazó este dispositivo durante la autenticación.',
  nextAuthRejected:
    'Confirma que el dispositivo sigue vinculado; vuelve a vincularlo si el rechazo se repite.',
  causeTailscaleTimeout:
    'El endpoint de Tailscale guardado no respondió antes de que se agotara el tiempo de conexión.',
  causeDirectTimeout:
    'El endpoint directo guardado no respondió antes de que se agotara el tiempo de conexión.',
  nextRelayRecoveryInProgress:
    'La recuperación de Relay está en curso; mantén Dolphin abierto mientras reintenta.',
  nextCheckNetwork: 'Revisa la red local/VPN y confirma que el escritorio esté activo.',
  causeHandshakeTimeout: 'El endpoint se abrió, pero el handshake cifrado de Dolphin no terminó.',
  nextHandshakeTimeout:
    'Confirma que el escritorio ejecuta una versión compatible de Dolphin y vuelve a intentarlo.',
  causeRelayRecoveryPending:
    'Se seleccionó la recuperación por Relay, pero aún no hay un fallo más concreto registrado.',
  nextRelayRecoveryPending:
    'Mantén esta página abierta mientras se registra el siguiente evento de recuperación.',
  causeUnknown:
    'No se puede determinar una única causa de fallo a partir de los eventos registrados.',
  nextUnknown:
    'Ejecuta el diagnóstico y vuelve a copiar el informe tras el siguiente intento de conexión.',
  causeRelayHostOffline:
    'Relay respondió, pero el escritorio no está conectado a él (código de cierre {code}, host sin conexión).',
  nextRelayHostOffline:
    'Comprueba que el escritorio esté activo, que Dolphin se esté ejecutando y que haya iniciado sesión en Dolphin Cloud.',
  causeRelayCredentialRefused:
    'Relay rechazó la credencial de relay de este dispositivo (código de cierre {code}).',
  nextRelayCredentialRefused: 'Vuelve a vincular este teléfono con el escritorio.',
  causeRelayUnreachable:
    'El teléfono no pudo acceder a la celda de Relay (cierre de transporte {code}).',
  nextRelayUnreachable:
    'Revisa la conexión de red de este teléfono; la recuperación de Relay se reintenta automáticamente.',
  causeRelayConnecting:
    'Relay cerró la conexión con el código {code}; la recuperación vuelve a resolver y reintenta.',
  nextRelayConnecting: 'Mantén Dolphin abierto mientras se reintenta la recuperación de Relay.',
  causeRelayDialNoAnswer: 'La conexión con Relay falló antes de que respondiera la celda.',
  // Developer and OTA rows
  hybridShellDevelopmentBuild: 'Shell híbrido (compilación de desarrollo)',
  hybridShellOtaBuild: 'Shell híbrido (compilación OTA)',
  openHybridShell: 'Abrir el shell híbrido del primer host vinculado',
  workspaceUpdates: 'Actualizaciones del espacio de trabajo',
  // Workspace update failures
  updateFailedAgo: 'La última actualización desde {host} falló hace {ago}: {reason}.',
  updateFailedJustNow: 'La última actualización desde {host} acaba de fallar: {reason}.',
  reasonWithGeneration: '{reason} (generación {generation})',
  outcomeOpenedCached: 'Se volvió a la versión guardada.',
  outcomeOpenedCachedGeneration: 'Se volvió a la versión guardada (generación {generation}).',
  outcomeWall: 'Se bloqueó el espacio de trabajo.',
  outcomeWallReason: 'Bloqueado: {reason}.',
  outcomeNativeRoute: 'Se mostró la pantalla nativa.',
  outcomeFailed: 'Se mostró la pantalla de error.',
  outcomeWaiting: 'Se esperó al host.',
  reasonNoConnection: 'sin conexión con el host',
  reasonConnectionLost: 'se perdió la conexión',
  reasonHostRefused: 'el host rechazó la lectura',
  reasonReplyUnreadable: 'el host envió una respuesta que esta app no pudo leer',
  reasonChunkOversize: 'un fragmento superaba el tamaño que permite el host',
  reasonAssetOverlong: 'un recurso era más largo de lo que declara el manifiesto',
  reasonAssetNoProgress: 'la lectura de un recurso no avanzó',
  reasonAssetShort: 'un recurso terminó antes de su tamaño declarado',
  reasonAssetChecksumMismatch: 'la suma de comprobación del recurso no coincide',
  reasonBuildChangedMidFetch: 'la compilación del host cambió durante la descarga',
  reasonChunkMisrouted: 'un fragmento respondió al recurso o desplazamiento equivocado',
  reasonAssetEntryChanged: 'un recurso dejó de coincidir con el manifiesto',
  reasonRangeUndecodable: 'no se pudo decodificar una lectura comprimida',
  reasonFetchStopped: 'se detuvo la descarga',
  reasonCacheWriteFailed: 'no se pudo guardar la descarga en este teléfono',
  reasonUnrecognisedError: 'un error no reconocido',
  hostCodeUnavailable: 'el host no tiene paquete del espacio de trabajo',
  hostCodeBuildChanged: 'la compilación del host cambió durante la descarga',
  hostCodeAssetUnknown: 'el host no reconoció un recurso',
  hostCodeAssetChanged: 'un recurso cambió en el host',
  hostCodeOffsetInvalid: 'el host rechazó un desplazamiento de lectura',
  hostCodeReadLimited: 'el host limitó las lecturas simultáneas',
  wallBundleUnavailable: 'el host no tiene paquete del espacio de trabajo',
  wallBundleShellTooOld: 'esta app es demasiado antigua para el paquete guardado',
  wallHostTooOldForBundle: 'el host es demasiado antiguo para el paquete guardado',
  wallBundleTooOldForHost: 'el paquete guardado es demasiado antiguo para el host'
}
