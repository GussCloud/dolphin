import { z } from 'zod'

export const AzureDevOpsSetAuthMethod = z.object({
  method: z.enum(['token', 'azure-cli'])
})

export const AzureDevOpsConfigureCliDefaults = z.object({
  organization: z.string().min(1),
  project: z.string().nullable().optional()
})
