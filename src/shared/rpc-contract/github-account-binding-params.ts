import { z } from 'zod'
import { RepoSelector } from './github-repo-target-params'
import { requiredString } from './rpc-param-primitives'

export const BindableAccounts = RepoSelector.extend({
  refreshCapability: z.boolean().optional()
})

/** No repo yet (add/clone dialogs): every gh login on the host, optionally for one GitHub host. */
export const HostAccounts = z.object({
  host: z.string().trim().min(1).optional(),
  refreshCapability: z.boolean().optional(),
  /** The distro whose gh a WSL project's git uses; malformed names are rejected. */
  wslDistro: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,64}$/)
    .optional()
})

export const ValidateAccountBinding = RepoSelector.extend({
  host: requiredString('Missing host'),
  user: requiredString('Missing user')
})
