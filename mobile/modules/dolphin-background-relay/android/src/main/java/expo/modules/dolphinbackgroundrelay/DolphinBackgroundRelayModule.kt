package expo.modules.dolphinbackgroundrelay

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DolphinBackgroundRelayModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DolphinBackgroundRelay")

    // Only called while the app is visible: Android 12+ refuses background starts.
    Function("start") { title: String, text: String ->
      try {
        BackgroundRelayService.start(context, title, text)
        true
      } catch (_: IllegalStateException) {
        false
      }
    }

    Function("stop") {
      BackgroundRelayService.stop(context)
      Unit
    }

    Function("isRunning") { BackgroundRelayService.instance != null }

    Function("enterBackground") { windowMs: Double? ->
      BackgroundRelayService.instance?.enterBackground(windowMs?.toLong())
      Unit
    }

    Function("enterForeground") {
      BackgroundRelayService.instance?.enterForeground()
      Unit
    }

    Function("isIgnoringBatteryOptimizations") {
      BackgroundRelayBatterySettings.isIgnoringBatteryOptimizations(context)
    }

    Function("requestIgnoreBatteryOptimizations") {
      BackgroundRelayBatterySettings.requestIgnoreBatteryOptimizations(context)
    }

    Function("hasAutostartSettings") { BackgroundRelayBatterySettings.hasAutostartSettings(context) }

    Function("openAutostartSettings") { BackgroundRelayBatterySettings.openAutostartSettings(context) }
  }
}
