import { z } from 'zod'

export const StorageGcParams = z.object({
  dryRun: z.boolean().optional(),
  olderThanDays: z.number().positive().max(3650).optional(),
  maxTotalBytes: z.number().int().positive().optional()
})
