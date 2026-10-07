import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { tasksWorkspaceEn } from './en'
import { tasksWorkspaceEs } from './es'
import { tasksWorkspaceFr } from './fr'
import { tasksWorkspaceJa } from './ja'
import { tasksWorkspaceKo } from './ko'
import { tasksWorkspacePtBR } from './pt-BR'
import { tasksWorkspaceZh } from './zh'

/** Workspace creation from a task (`src/tasks/**`). */
export const tasksWorkspaceCatalog = defineMobileCatalog({
  en: tasksWorkspaceEn,
  zh: tasksWorkspaceZh,
  ko: tasksWorkspaceKo,
  ja: tasksWorkspaceJa,
  es: tasksWorkspaceEs,
  fr: tasksWorkspaceFr,
  'pt-BR': tasksWorkspacePtBR
})
