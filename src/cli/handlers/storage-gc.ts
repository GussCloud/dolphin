import type { StorageGcResult } from '../../shared/storage-gc-types'
import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag } from '../flags'
import { printResult } from '../format'
import { parseGcAgeDays, parseGcMaxBytes } from '../storage-gc-args'
import { formatStorageGcResult } from '../storage-gc-format'

export const STORAGE_GC_HANDLERS: Record<string, CommandHandler> = {
  gc: async ({ client, flags, json }) => {
    const olderThan = getOptionalStringFlag(flags, 'older-than')
    const maxSize = getOptionalStringFlag(flags, 'max-size')
    const result = await client.call<StorageGcResult>('storage.gc', {
      dryRun: flags.get('dry-run') === true,
      ...(olderThan ? { olderThanDays: parseGcAgeDays(olderThan) } : {}),
      ...(maxSize ? { maxTotalBytes: parseGcMaxBytes(maxSize) } : {})
    })
    printResult(result, json, (r) => formatStorageGcResult(r))
  }
}
