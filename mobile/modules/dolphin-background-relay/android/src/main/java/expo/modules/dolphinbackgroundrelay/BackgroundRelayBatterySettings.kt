package expo.modules.dolphinbackgroundrelay

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

// System screens the user must visit so OEM battery managers leave the service alone.
object BackgroundRelayBatterySettings {
  // MIUI/HyperOS kill foreground services of apps without the Autostart grant.
  private val XIAOMI_AUTOSTART =
    ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")

  fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }
    val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return power.isIgnoringBatteryOptimizations(context.packageName)
  }

  @SuppressLint("BatteryLife")
  fun requestIgnoreBatteryOptimizations(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false
    }
    val request =
      Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
    return launch(context, request) ||
      launch(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
  }

  fun hasAutostartSettings(context: Context): Boolean =
    Intent().setComponent(XIAOMI_AUTOSTART).resolveActivity(context.packageManager) != null

  fun openAutostartSettings(context: Context): Boolean =
    launch(context, Intent().setComponent(XIAOMI_AUTOSTART)) ||
      launch(
        context,
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      )

  private fun launch(context: Context, intent: Intent): Boolean =
    try {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (_: Exception) {
      false
    }
}
