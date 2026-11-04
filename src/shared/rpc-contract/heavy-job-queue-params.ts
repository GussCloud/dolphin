import { z } from 'zod'
import { OptionalFiniteNumber, OptionalString, requiredString } from './rpc-param-primitives'

export const HeavyJobAcquireParams = z.object({
  queueKey: requiredString('Missing queueKey'),
  holder: requiredString('Missing holder'),
  ticket: OptionalString,
  waitMs: OptionalFiniteNumber
})

export const HeavyJobTicketParams = z.object({
  ticket: requiredString('Missing ticket')
})
