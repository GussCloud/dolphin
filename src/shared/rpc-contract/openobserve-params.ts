import { z } from 'zod'

export const OpenObserveSaveContext = z.object({
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  org: z.string().min(1),
  authScheme: z.enum(['basic', 'token', 'session'])
})

export const OpenObserveActivateContext = z.object({
  name: z.string().min(1)
})
