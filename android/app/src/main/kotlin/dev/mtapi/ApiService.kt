package dev.mtapi

import android.app.*
import android.app.AlarmManager
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import go.mobile.mobile.Mobile

class ApiService : LifecycleService() {

    private var started = false

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (!started) {
            val token = Token.getOrCreate(this)
            try {
                // pass `this` so AndroidApiImpl sees a LifecycleOwner for CameraX
                Mobile.start(token, AndroidApiImpl(this))
                started = true
            } catch (t: Throwable) {
                android.util.Log.e("mtapi", "start failed", t)
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = super.onBind(intent)

    override fun onTaskRemoved(rootIntent: Intent?) {
        val restart = Intent(applicationContext, ApiService::class.java)
        val pi = PendingIntent.getService(
            this, 1, restart,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ONE_SHOT
        )
        val am = getSystemService(AlarmManager::class.java)
        am?.set(AlarmManager.RTC, System.currentTimeMillis() + 1500L, pi)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        try { Mobile.stop() } catch (_: Throwable) {}
        started = false
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val ch = "mtapi"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(ch, "mtapi daemon", NotificationManager.IMPORTANCE_LOW)
                )
            }
        }
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, ch)
            .setContentTitle("mtapi")
            .setContentText("daemon listening on @mtapi")
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
    }

    companion object { const val NOTIF_ID = 0x4d5441 }
}
