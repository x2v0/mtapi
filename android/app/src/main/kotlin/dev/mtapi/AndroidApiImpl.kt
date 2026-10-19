package dev.mtapi

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Telephony
import android.speech.tts.TextToSpeech
import android.telephony.SmsManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import go.mobile.mobile.AndroidAPI
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class AndroidApiImpl(private val ctx: Context) : AndroidAPI {

    private fun need(perm: String) {
        if (ContextCompat.checkSelfPermission(ctx, perm) != PackageManager.PERMISSION_GRANTED) {
            throw RuntimeException("permission_required: $perm")
        }
    }

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
        Handler(ctx.mainLooper).post {
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
            if (best == null || l.time > best!!.time) best = l
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
        val latch = CountDownLatch(1)
        var t: TextToSpeech? = null
        t = TextToSpeech(ctx) { status ->
            if (status == TextToSpeech.SUCCESS) {
                t?.language = Locale.getDefault()
                t?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mtapi")
            }
            latch.countDown()
        }
        if (!latch.await(5, TimeUnit.SECONDS)) {
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

    // ── CameraX ────────────────────────────────────────────
    override fun cameraPhoto(path: String): String {
        need(Manifest.permission.CAMERA)

        val file: File = if (path.isBlank() || !path.startsWith("/")) {
            val dir = File(ctx.filesDir, "photos").apply { mkdirs() }
            File(dir, "img_${System.currentTimeMillis()}.jpg")
        } else {
            File(path).also { it.parentFile?.mkdirs() }
        }

        val owner = ctx as? LifecycleOwner
            ?: throw RuntimeException("camera_no_lifecycle")

        val latch = CountDownLatch(1)
        val errRef = AtomicReference<Throwable?>(null)
        val executor = Executors.newSingleThreadExecutor()

        executor.execute {
            try {
                val provider = ProcessCameraProvider
                    .getInstance(ctx)
                    .get(10, TimeUnit.SECONDS)

                val imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .build()

                val outputOpts = ImageCapture.OutputFileOptions.Builder(file).build()

                val bindLatch = CountDownLatch(1)
                Handler(ctx.mainLooper).post {
                    try {
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            owner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            imageCapture,
                        )
                    } catch (t: Throwable) {
                        errRef.set(t)
                    } finally {
                        bindLatch.countDown()
                    }
                }
                bindLatch.await(10, TimeUnit.SECONDS)
                if (errRef.get() != null) throw errRef.get()!!

                imageCapture.takePicture(
                    outputOpts,
                    executor,
                    object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(o: ImageCapture.OutputFileResults) {
                            latch.countDown()
                        }
                        override fun onError(e: ImageCaptureException) {
                            errRef.set(e)
                            latch.countDown()
                        }
                    },
                )
            } catch (t: Throwable) {
                errRef.set(t)
                latch.countDown()
            }
        }

        try {
            if (!latch.await(30, TimeUnit.SECONDS)) {
                throw RuntimeException("camera_timeout")
            }
            val err = errRef.get()
            if (err != null) {
                throw RuntimeException("camera_failed: ${err.message}")
            }
            return file.absolutePath
        } finally {
            executor.shutdown()
        }
    }

    // ── contacts / calllog / sms ───────────────────────────

    override fun contactsList(limit: Int): String {
        need(Manifest.permission.READ_CONTACTS)
        val uri  = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val proj = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        )
        val arr = JSONArray()
        ctx.contentResolver.query(
            uri, proj, null, null,
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )?.use { c ->
            var n = 0
            while (c.moveToNext() && n < limit) {
                val name = c.getString(0) ?: ""
                val num  = c.getString(1) ?: ""
                if (num.isBlank()) continue
                arr.put(JSONObject().put("name", name).put("phone", num))
                n++
            }
        }
        return arr.toString()
    }

    override fun callLogList(limit: Int): String {
        need(Manifest.permission.READ_CALL_LOG)
        val proj = arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )
        val arr = JSONArray()
        ctx.contentResolver.query(
            CallLog.Calls.CONTENT_URI, proj, null, null,
            "${CallLog.Calls.DATE} DESC"
        )?.use { c ->
            var n = 0
            while (c.moveToNext() && n < limit) {
                arr.put(JSONObject()
                    .put("number",   c.getString(0) ?: "")
                    .put("type",     c.getInt(1))
                    .put("ts",       c.getLong(2))
                    .put("duration", c.getLong(3)))
                n++
            }
        }
        return arr.toString()
    }

    override fun smsList(limit: Int): String {
        need(Manifest.permission.READ_SMS)
        val proj = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
        )
        val arr = JSONArray()
        ctx.contentResolver.query(
            Telephony.Sms.CONTENT_URI, proj, null, null,
            "${Telephony.Sms.DATE} DESC"
        )?.use { c ->
            var n = 0
            while (c.moveToNext() && n < limit) {
                arr.put(JSONObject()
                    .put("address", c.getString(0) ?: "")
                    .put("body",    c.getString(1) ?: "")
                    .put("ts",      c.getLong(2))
                    .put("type",    c.getInt(3)))
                n++
            }
        }
        return arr.toString()
    }

    override fun smsSend(to: String, text: String) {
        need(Manifest.permission.SEND_SMS)
        val sm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ctx.getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }
        sm.sendTextMessage(to, null, text, null, null)
    }
}
