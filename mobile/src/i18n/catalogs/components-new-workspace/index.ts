import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { componentsNewWorkspaceEn } from './en'
import { componentsNewWorkspaceEs } from './es'
import { componentsNewWorkspaceFr } from './fr'
import { componentsNewWorkspaceJa } from './ja'
import { componentsNewWorkspaceKo } from './ko'
import { componentsNewWorkspacePtBR } from './pt-BR'
import { componentsNewWorkspaceZh } from './zh'

/** New workspace / worktree flow (`src/components/NewWorktree*`, `NewWorkspace*`, `SmartWorkspace*`, home quick actions). */
export const componentsNewWorkspaceCatalog = defineMobileCatalog({
  en: componentsNewWorkspaceEn,
  zh: componentsNewWorkspaceZh,
  ko: componentsNewWorkspaceKo,
  ja: componentsNewWorkspaceJa,
  es: componentsNewWorkspaceEs,
  fr: componentsNewWorkspaceFr,
  'pt-BR': componentsNewWorkspacePtBR
})
