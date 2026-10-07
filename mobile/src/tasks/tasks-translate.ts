import { tasksCatalog } from '../i18n/catalogs/tasks'
import { tasksDetailCatalog } from '../i18n/catalogs/tasks-detail'
import { tasksWorkspaceCatalog } from '../i18n/catalogs/tasks-workspace'
import { defineMobileCatalog, type MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { translate } from '../i18n/mobile-locale-state'

// Why one merged catalog: the namespaces are split only to keep each file small; Tasks code
// reads them as one key set, and their keys never overlap.
export const tasksCopyCatalog = defineMobileCatalog({
  en: { ...tasksCatalog.en, ...tasksDetailCatalog.en, ...tasksWorkspaceCatalog.en },
  zh: { ...tasksCatalog.zh, ...tasksDetailCatalog.zh, ...tasksWorkspaceCatalog.zh },
  ko: { ...tasksCatalog.ko, ...tasksDetailCatalog.ko, ...tasksWorkspaceCatalog.ko },
  ja: { ...tasksCatalog.ja, ...tasksDetailCatalog.ja, ...tasksWorkspaceCatalog.ja },
  es: { ...tasksCatalog.es, ...tasksDetailCatalog.es, ...tasksWorkspaceCatalog.es },
  fr: { ...tasksCatalog.fr, ...tasksDetailCatalog.fr, ...tasksWorkspaceCatalog.fr },
  'pt-BR': {
    ...tasksCatalog['pt-BR'],
    ...tasksDetailCatalog['pt-BR'],
    ...tasksWorkspaceCatalog['pt-BR']
  }
})

export type TasksTranslate = MobileTranslate<(typeof tasksCopyCatalog)['en']>

/** Active-locale Tasks copy for render functions, helpers and async callbacks. */
export const translateTasks: TasksTranslate = (key, ...args) =>
  translate(tasksCopyCatalog, key, ...args)
