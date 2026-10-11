package expo.modules.livelessonnotification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The live lesson outside the app (docs/mobile/immersive-design.md §10): ONE ongoing notification
 * whose time is the system's own chronometer, counting up from the server's start, so it keeps
 * ticking while the app sleeps. On Android 16+ it asks to be promoted to a Live Update (the
 * status-bar chip). The text comes from the app's facade (src/features/teaching/live-surface.ts),
 * which only ever passes "Lesson in progress": no name, mode, note or amount reaches this module.
 */
class ShowOptions : Record {
  @Field var title: String = ""
  @Field var startedAtMs: Double = 0.0
  @Field var endsAtMs: Double? = null
  @Field var openUrl: String = ""
  @Field var stopUrl: String = ""
  @Field var stopLabel: String = "Stop"
}

class LiveLessonNotificationModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No React context" }

  override fun definition() = ModuleDefinition {
    Name("LiveLessonNotification")

    Function("show") { options: ShowOptions ->
      show(options)
    }

    Function("end") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    Function("isShowing") {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.activeNotifications.any { it.id == NOTIFICATION_ID }
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // Default importance (a Live Update may not use MIN), but silent: the lesson is already under
    // way when this appears, so it never rings or buzzes.
    val channel = NotificationChannel(CHANNEL_ID, "Live lesson", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "The timer of a lesson you have running."
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  private fun deepLink(url: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun build(options: ShowOptions): NotificationCompat.Builder {
    val startedAt = options.startedAtMs.toLong()
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_live_lesson)
      .setContentTitle(options.title)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setAutoCancel(false)
      .setWhen(startedAt)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(deepLink(options.openUrl, 1))
      .addAction(0, options.stopLabel, deepLink(options.stopUrl, 2))
      .setRequestPromotedOngoing(true)
    // The server stops the lesson at its limit; the notification goes then too, app awake or not.
    options.endsAtMs?.let { endsAt ->
      val remaining = endsAt.toLong() - System.currentTimeMillis()
      if (remaining > 0) builder.setTimeoutAfter(remaining)
    }
    return builder
  }

  private fun show(options: ShowOptions): Boolean {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
    ensureChannel()
    // The lock screen's public version is the same, already non-sensitive, content.
    val notification = build(options).setPublicVersion(build(options).build()).build()
    return try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      true
    } catch (_: SecurityException) {
      false
    }
  }

  companion object {
    private const val CHANNEL_ID = "live-lesson"
    private const val NOTIFICATION_ID = 4501
  }
}
