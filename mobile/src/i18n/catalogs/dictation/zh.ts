import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationZh: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop: '请更新已配对的桌面端 Dolphin 应用以使用移动端语音设置。',
  loadModelsFailed: '加载听写模型失败',
  downloadFailed: '无法开始下载',
  deleteFailed: '删除模型失败',
  updateSettingsFailed: '更新听写设置失败',
  microphonePermissionDenied: '麦克风权限被拒绝',
  microphoneInitFailed: '麦克风初始化失败'
}
