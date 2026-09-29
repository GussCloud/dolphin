import { Redirect, useRouter } from 'expo-router'
import BackgroundConnectionSettingsScreen from '../src/settings/background-connection-settings-screen'
import { nativeBackgroundRelay } from '../src/platform/native-background-relay'

export default function NativeBackgroundConnectionRoute() {
  const router = useRouter()
  if (!nativeBackgroundRelay) {
    return <Redirect href="/settings" />
  }
  return (
    <BackgroundConnectionSettingsScreen
      native={nativeBackgroundRelay}
      onBack={() => router.back()}
    />
  )
}
