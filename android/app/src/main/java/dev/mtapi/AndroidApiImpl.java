package dev.mtapi;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.Telephony;
import android.speech.tts.TextToSpeech;
import android.telephony.SmsManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;


public class AndroidApiImpl implements AndroidAPI {

    private final Context ctx;

    public AndroidApiImpl(Context ctx) {
        this.ctx = ctx;
    }

    private void need(String perm) {
        if (ctx.checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
            throw new RuntimeException("permission_required: " + perm);
        }
    }

    @Override
    public String batteryStatus() throws Exception {
        BatteryManager bm = (BatteryManager) ctx.getSystemService(Context.BATTERY_SERVICE);
        int pct = bm == null ? -1 : bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        return new JSONObject()
                .put("percentage", pct)
                .put("charging", bm != null && bm.isCharging())
                .toString();
    }

    @Override
    public String wifiInfo() throws Exception {
        WifiManager wm = (WifiManager) ctx.getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
        WifiInfo info = wm == null ? null : wm.getConnectionInfo();
        if (info == null) throw new RuntimeException("no_wifi");
        return new JSONObject()
                .put("ssid", String.valueOf(info.getSSID()))
                .put("rssi", info.getRssi())
                .put("link_speed", info.getLinkSpeed())
                .toString();
    }

    @Override
    public String clipboardGet() throws Exception {
        ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null || cm.getPrimaryClip() == null) return "";
        CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(ctx);
        return t == null ? "" : t.toString();
    }

    @Override
    public void clipboardSet(String text) throws Exception {
        ClipboardManager cm = (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mtapi", text));
    }

    @Override
    public void toast(String text) throws Exception {
        new Handler(Looper.getMainLooper()).post(() ->
                android.widget.Toast.makeText(ctx, text, android.widget.Toast.LENGTH_SHORT).show());
    }

    @Override
    public void notify(String title, String body) throws Exception {
        android.app.NotificationManager nm =
                (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        String ch = "mtapi-notify";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(new android.app.NotificationChannel(
                        ch, "notifications", android.app.NotificationManager.IMPORTANCE_DEFAULT));
            }
        }
        android.app.Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new android.app.Notification.Builder(ctx, ch);
        } else {
            b = new android.app.Notification.Builder(ctx);
        }
        b.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body);
        if (nm != null) nm.notify((int) (System.currentTimeMillis() & 0xffff), b.build());
    }

    @Override
    public void vibrate(int ms) throws Exception {
        Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            v.vibrate(ms);
        }
    }

    @Override
    public void torch(boolean on) throws Exception {
        CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) throw new RuntimeException("no_camera");
        String id = null;
        for (String c : cm.getCameraIdList()) {
            Boolean has = cm.getCameraCharacteristics(c).get(
                    CameraCharacteristics.FLASH_INFO_AVAILABLE);
            if (has != null && has) { id = c; break; }
        }
        if (id == null) throw new RuntimeException("no_flash");
        cm.setTorchMode(id, on);
    }

    @Override
    public String deviceInfo() throws Exception {
        return new JSONObject()
                .put("manufacturer", Build.MANUFACTURER)
                .put("model", Build.MODEL)
                .put("device", Build.DEVICE)
                .put("sdk", Build.VERSION.SDK_INT)
                .put("release", Build.VERSION.RELEASE)
                .put("abi", String.join(",", Build.SUPPORTED_ABIS))
                .put("fingerprint", Build.FINGERPRINT)
                .toString();
    }

    @Override
    public String locationLast() throws Exception {
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) throw new RuntimeException("no_location");
        List<String> providers = lm.getProviders(true);
        Location best = null;
        for (String p : providers) {
            Location l;
            try { l = lm.getLastKnownLocation(p); }
            catch (SecurityException e) { continue; }
            if (l == null) continue;
            if (best == null || l.getTime() > best.getTime()) best = l;
        }
        if (best == null) throw new RuntimeException("no_location");
        return new JSONObject()
                .put("lat", best.getLatitude())
                .put("lon", best.getLongitude())
                .put("acc", best.getAccuracy())
                .put("provider", best.getProvider())
                .put("ts", best.getTime())
                .toString();
    }

    @Override
    public void tts(String text) throws Exception {
        final CountDownLatch latch = new CountDownLatch(1);
        final TextToSpeech[] ref = new TextToSpeech[1];
        ref[0] = new TextToSpeech(ctx, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ref[0].setLanguage(Locale.getDefault());
                ref[0].speak(text, TextToSpeech.QUEUE_FLUSH, null, "mtapi");
            }
            latch.countDown();
        });
        if (!latch.await(5, TimeUnit.SECONDS)) {
            throw new RuntimeException("tts_init_timeout");
        }
    }

    @Override
    public void share(String title, String text) throws Exception {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_SUBJECT, title);
        i.putExtra(Intent.EXTRA_TEXT, text);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent chooser = Intent.createChooser(i, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(chooser);
    }

    @Override
    public String cameraPhoto(String path) throws Exception {
        // Camera requires an Activity context (system intent capture).
        // From a long-lived Service, the recommended path is to expose
        // a "camera_open" method that starts MainActivity with an intent.
        // For now: explicit, honest error.
        need(Manifest.permission.CAMERA);
        throw new RuntimeException(
                "camera_requires_activity: call via MainActivity, "
              + "or use torch for illumination");
    }

    @Override
    public String contactsList(int limit) throws Exception {
        need(Manifest.permission.READ_CONTACTS);
        String[] proj = {
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
        };
        JSONArray arr = new JSONArray();
        android.database.Cursor c = ctx.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                proj, null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC");
        if (c != null) {
            try {
                int n = 0;
                while (c.moveToNext() && n < limit) {
                    String name = c.getString(0);
                    String num  = c.getString(1);
                    if (num == null || num.isEmpty()) continue;
                    arr.put(new JSONObject()
                            .put("name", name == null ? "" : name)
                            .put("phone", num));
                    n++;
                }
            } finally { c.close(); }
        }
        return arr.toString();
    }

    @Override
    public String callLogList(int limit) throws Exception {
        need(Manifest.permission.READ_CALL_LOG);
        String[] proj = {
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
        };
        JSONArray arr = new JSONArray();
        android.database.Cursor c = ctx.getContentResolver().query(
                CallLog.Calls.CONTENT_URI, proj, null, null,
                CallLog.Calls.DATE + " DESC");
        if (c != null) {
            try {
                int n = 0;
                while (c.moveToNext() && n < limit) {
                    arr.put(new JSONObject()
                            .put("number",   c.getString(0))
                            .put("type",     c.getInt(1))
                            .put("ts",       c.getLong(2))
                            .put("duration", c.getLong(3)));
                    n++;
                }
            } finally { c.close(); }
        }
        return arr.toString();
    }

    @Override
    public String smsList(int limit) throws Exception {
        need(Manifest.permission.READ_SMS);
        String[] proj = {
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE,
        };
        JSONArray arr = new JSONArray();
        android.database.Cursor c = ctx.getContentResolver().query(
                Telephony.Sms.CONTENT_URI, proj, null, null,
                Telephony.Sms.DATE + " DESC");
        if (c != null) {
            try {
                int n = 0;
                while (c.moveToNext() && n < limit) {
                    arr.put(new JSONObject()
                            .put("address", c.getString(0))
                            .put("body",    c.getString(1))
                            .put("ts",      c.getLong(2))
                            .put("type",    c.getInt(3)));
                    n++;
                }
            } finally { c.close(); }
        }
        return arr.toString();
    }

    @Override
    public void smsSend(String to, String text) throws Exception {
        need(Manifest.permission.SEND_SMS);
        SmsManager sm;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            sm = ctx.getSystemService(SmsManager.class);
        } else {
            sm = SmsManager.getDefault();
        }
        if (sm == null) throw new RuntimeException("sms_manager_unavailable");
        sm.sendTextMessage(to, null, text, null, null);
    }
}
