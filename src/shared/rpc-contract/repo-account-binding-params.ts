import { z } from 'zod'
import { normalizeRepoAccountBinding } from '../source-control-account-types'

/** Optional on every create/add/clone/import call so older clients and hosts stay wire-compatible. */
export const RepoAccountBindingParam = z
  .unknown()
  .optional()
  .transform((value) => normalizeRepoAccountBinding(value))
