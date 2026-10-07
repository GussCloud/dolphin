import type { PickerOption } from '../components/PickerModal'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import type { worktreeEn } from '../i18n/catalogs/worktree/en'
import type { MobileGroupMode, MobileSortMode } from './workspace-view-settings'

type WorktreeTranslate = MobileTranslate<typeof worktreeEn>

export function workspaceSortOptions(t: WorktreeTranslate): PickerOption<MobileSortMode>[] {
  return [
    // Why: desktop and persisted state keep the `smart` key, while mobile shows the product label.
    { value: 'smart', label: t('sortSmart'), subtitle: t('sortSmartSubtitle') },
    { value: 'name', label: t('sortName'), subtitle: t('sortNameSubtitle') },
    { value: 'recent', label: t('sortRecent'), subtitle: t('sortRecentSubtitle') },
    { value: 'repo', label: t('sortRepo'), subtitle: t('sortRepoSubtitle') },
    { value: 'manual', label: t('sortManual'), subtitle: t('sortManualSubtitle') }
  ]
}

export function workspaceGroupOptions(t: WorktreeTranslate): PickerOption<MobileGroupMode>[] {
  return [
    { value: 'none', label: t('groupNone') },
    { value: 'workspaceStatus', label: t('groupStatus') },
    { value: 'repo', label: t('groupRepository') },
    { value: 'prStatus', label: t('groupPrStatus') }
  ]
}
