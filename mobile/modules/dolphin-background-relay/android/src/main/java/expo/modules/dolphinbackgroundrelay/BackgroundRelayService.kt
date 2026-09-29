package expo.modules.dolphinbackgroundrelay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

// Holds the process at foreground-service priority so the OS neither freezes the JS
// runtime nor drops its Relay socket while the app is backgrounded.
class BackgroundRelayService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val expire = Runnable { stopSelf() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Dolphin"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
    val notification = buildNotification(title, text)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    instance = this
    // Why: a restarted service without the JS runtime would hold nothing open.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(expire)
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  fun enterBackground(windowMs: Long?) {
    handler.removeCallbacks(expire)
    if (windowMs != null) {
      handler.postDelayed(expire, windowMs)
    }
  }

  fun enterForeground() {
    handler.removeCallbacks(expire)
  }

  private fun buildNotification(title: String, text: String): Notification {
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Background connection", NotificationManager.IMPORTANCE_MIN)
            .apply { setShowBadge(false) }
        )
        Notification.Builder(this, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
      }
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      builder.setContentIntent(
        PendingIntent.getActivity(
          this,
          0,
          launch,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
      )
    }
    return builder
      .setSmallIcon(notificationIcon())
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setShowWhen(false)
      .build()
  }

  // expo-notifications generates `notification_icon` from app.config; fall back to the launcher icon.
  private fun notificationIcon(): Int {
    val generated = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (generated != 0) generated else applicationInfo.icon
  }

  companion object {
    private const val CHANNEL_ID = "dolphin-background-relay"
    private const val NOTIFICATION_ID = 7310
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_TEXT = "text"

    @Volatile
    var instance: BackgroundRelayService? = null
      private set

    fun start(context: Context, title: String, text: String) {
      val intent =
        Intent(context, BackgroundRelayService::class.java)
          .putExtra(EXTRA_TITLE, title)
          .putExtra(EXTRA_TEXT, text)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BackgroundRelayService::class.java))
    }
  }
}
