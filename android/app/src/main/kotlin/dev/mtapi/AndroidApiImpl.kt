package dev.mtapi

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import go.mobile.mobile.AndroidAPI
import org.json.JSONObject
import java.util.Locale

class AndroidApiImpl(private val ctx: Context) : AndroidAPI {

    override fun batteryStatus(): String {
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return JSONObject().apply {
            put("percentage", pct)
            put("charging", bm.isCharging)
        }.toString()
    }

    override fun wifiInfo(): String {
        val wm = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        val info = wm.connectionInfo ?: throw RuntimeException("no_wifi")
        @Suppress("DEPRECATION")
        return JSONObject().apply {
            put("ssid", info.ssid)
            put("rssi", info.rssi)
            put("link_speed", info.linkSpeed)
        }.toString()
    }

    override fun clipboardGet(): String {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        return cm.primaryClip?.getItemAt(0)?.coerceToText(ctx)?.toString() ?: ""
    }

    override fun clipboardSet(text: String) {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("mtapi", text))
    }

    override fun toast(text: String) {
        android.os.Handler(ctx.mainLooper).post {
            android.widget.Toast.makeText(ctx, text, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    override fun notify(title: String, body: String) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val ch = "mtapi-notify"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(
                    android.app.NotificationChannel(ch, "notifications",
                        android.app.NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
        }
        val n = androidx.core.app.NotificationCompat.Builder(ctx, ch)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .build()
        nm.notify((System.currentTimeMillis() and 0xffff).toInt(), n)
    }

    override fun vibrate(ms: Int) {
        val v = ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION") v.vibrate(ms.toLong())
        }
    }

    override fun torch(on: Boolean) {
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull { c ->
            cm.getCameraCharacteristics(c)
                .get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: throw RuntimeException("no_flash")
        cm.setTorchMode(id, on)
    }

    override fun deviceInfo(): String = JSONObject().apply {
        put("manufacturer", Build.MANUFACTURER)
        put("model", Build.MODEL)
        put("device", Build.DEVICE)
        put("sdk", Build.VERSION.SDK_INT)
        put("release", Build.VERSION.RELEASE)
        put("abi", Build.SUPPORTED_ABIS.joinToString(","))
        put("fingerprint", Build.FINGERPRINT)
    }.toString()

    override fun locationLast(): String {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        @Suppress("MissingPermission")
        val providers = lm.getProviders(true)
        var best: android.location.Location? = null
        for (p in providers) {
            @Suppress("MissingPermission")
            val l = lm.getLastKnownLocation(p) ?: continue
            if (best == null || l.time > best.time) best = l
        }
        val l = best ?: throw RuntimeException("no_location")
        return JSONObject().apply {
            put("lat", l.latitude)
            put("lon", l.longitude)
            put("acc", l.accuracy)
            put("provider", l.provider)
            put("ts", l.time)
        }.toString()
    }

    override fun tts(text: String) {
        val latch = java.util.concurrent.CountDownLatch(1)
        var t: TextToSpeech? = null
        t = TextToSpeech(ctx) { status ->
            if (status == TextToSpeech.SUCCESS) {
                t?.language = Locale.getDefault()
                t?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mtapi")
            }
            latch.countDown()
        }
        if (!latch.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
            throw RuntimeException("tts_init_timeout")
        }
    }

    override fun share(title: String, text: String) {
        val i = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(Intent.createChooser(i, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun cameraPhoto(path: String) {
        throw RuntimeException("camera_not_implemented")
    }
}
