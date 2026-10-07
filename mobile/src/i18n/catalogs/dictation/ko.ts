import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationKo: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop: '모바일 음성 설정을 사용하려면 페어링된 데스크톱 Dolphin 앱을 업데이트하세요.',
  loadModelsFailed: '받아쓰기 모델을 불러오지 못했습니다',
  downloadFailed: '다운로드를 시작하지 못했습니다',
  deleteFailed: '모델을 삭제하지 못했습니다',
  updateSettingsFailed: '받아쓰기 설정을 업데이트하지 못했습니다',
  microphonePermissionDenied: '마이크 권한이 거부되었습니다',
  microphoneInitFailed: '마이크를 초기화하지 못했습니다'
}
