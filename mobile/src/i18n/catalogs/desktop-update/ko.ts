import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdateKo: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: '업데이트 있음',
  tagReady: '업데이트 준비됨',
  tagManual: '업데이트 있음 · 데스크톱에서 설치',
  tagStarting: '업데이트 시작 중…',
  tagDownloading: '다운로드 중 {percent}%',
  tagInstalling: '데스크톱 재시작 중…',
  tagFailed: '업데이트 실패 · 다시 시도',
  // Install confirmation
  confirmInstallVersion:
    '"{hostName}"에 Dolphin {version}을(를) 설치할까요? 해당 데스크톱에서 Dolphin이 다시 시작됩니다.',
  confirmInstallLatest:
    '"{hostName}"에 최신 Dolphin을 설치할까요? 해당 데스크톱에서 Dolphin이 다시 시작됩니다.',
  confirmLastAttemptFailed: '지난 시도 실패: {message}',
  // Errors
  errorRestartedOnOlder:
    '데스크톱이 {installedVersion}(으)로 다시 시작되었습니다. {targetVersion}은(는) 설치되지 않았습니다.',
  errorManualRequired: '이 데스크톱은 수동으로 업데이트해야 합니다.',
  errorNotAvailable: '데스크톱이 더 이상 사용 가능한 업데이트를 보고하지 않습니다.',
  errorNotDownloaded: '데스크톱에서 업데이트 다운로드가 아직 끝나지 않았습니다.',
  errorUpdaterTimeout: '데스크톱 업데이트 프로그램을 기다리다 시간이 초과되었습니다.'
}
