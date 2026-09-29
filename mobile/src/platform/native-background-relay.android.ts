import { requireOptionalNativeModule } from 'expo-modules-core'
import type { NativeBackgroundRelay } from './native-background-relay'

// Optional: an OTA bundle can land on a binary built before this module existed.
export const nativeBackgroundRelay =
  requireOptionalNativeModule<NativeBackgroundRelay>('DolphinBackgroundRelay')
