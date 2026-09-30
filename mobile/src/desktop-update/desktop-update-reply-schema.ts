import { z } from 'zod'

// Checked against `updater.getStatus` / `updater.download` / `updater.install`
// (src/main/runtime/rpc/methods/updater.ts → RemoteServerUpdaterSnapshot / InstallResult).

// Why loose: the host's UpdateStatus union grows additively; unknown states read as "no offer".
export const desktopUpdaterSnapshotSchema = z.looseObject({
  appVersion: z.string(),
  support: z.looseObject({ automatic: z.boolean() }),
  status: z.looseObject({
    state: z.string(),
    version: z.string().optional(),
    percent: z.number().optional(),
    message: z.string().optional()
  })
})

export type DesktopUpdaterSnapshot = z.infer<typeof desktopUpdaterSnapshotSchema>

export const desktopUpdateInstallSchema = z.looseObject({
  accepted: z.literal(true),
  targetVersion: z.string()
})
