import type { PushNotification } from '@dolphin-cloud/push-contract'

export function parsePushDeliveryPayload(payload: string): PushNotification {
  const value: unknown = JSON.parse(payload)
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_push_delivery_payload')
  return value as PushNotification
}
