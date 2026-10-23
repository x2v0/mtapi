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
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import android.os.Environment;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.telephony.TelephonyManager;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.content.pm.FeatureInfo;
import java.util.Collections;
import java.util.TimeZone;


import java.net.NetworkInterface;
import java.net.InterfaceAddress;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.provider.Settings;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.File;
import java.util.Set;
import java.util.HashMap;
import java.util.Map;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.content.ContentValues;
import android.media.MediaPlayer;
import android.location.LocationListener;
import android.location.Location;
import android.speech.tts.Voice;
import java.io.OutputStream;
import java.util.Set;

public class AndroidApiImpl implements AndroidAPI {

    private final Context ctx;
    private static final java.util.Map<String, SensorEventListener> sseRegistry = new ConcurrentHashMap<>();
    private static volatile Thread clipWatchThread = null;
    private static volatile Thread locWatchThread = null;
    private static volatile android.location.LocationManager sLocLm = null;
    private static volatile android.location.LocationListener sLocListener = null;
    private static volatile android.os.Looper sLocLooper = null;
    private static volatile android.media.MediaPlayer player = null;
    private static volatile android.speech.tts.TextToSpeech cachedTts = null;

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

    private static final long SMS_RATE_LIMIT_MS = 30_000L;
    private static final int SMS_MAX_LEN = 1000;
    private static final String SMS_PREFS = "mtapi_sms";
    private static final String SMS_KEY_LAST = "last_send_ms";

    @Override
    public void smsSend(String to, String text) throws Exception {
        need(Manifest.permission.SEND_SMS);
        if (to == null || to.isEmpty()) throw new RuntimeException("sms_to_required");
        String digits = to.replaceAll("[^0-9+]", "");
        if (!digits.matches("^\\+?[0-9]{5,15}$")) {
            throw new RuntimeException("sms_to_invalid: " + to);
        }
        if (text == null) text = "";
        if (text.length() > SMS_MAX_LEN) {
            throw new RuntimeException("sms_text_too_long: max=" + SMS_MAX_LEN);
        }
        android.content.SharedPreferences sp = ctx.getSharedPreferences(SMS_PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long last = sp.getLong(SMS_KEY_LAST, 0L);
        if (now - last < SMS_RATE_LIMIT_MS) {
            long wait = (SMS_RATE_LIMIT_MS - (now - last)) / 1000;
            throw new RuntimeException("sms_rate_limited: wait " + wait + "s");
        }
        SmsManager sm;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            sm = ctx.getSystemService(SmsManager.class);
        } else {
            sm = SmsManager.getDefault();
        }
        if (sm == null) throw new RuntimeException("sms_manager_unavailable");
        sm.sendTextMessage(to, null, text, null, null);
        sp.edit().putLong(SMS_KEY_LAST, now).apply();
    }
    // ─── Extended info (patch 34) ───────────────────────────

    @Override
    public String sensorsList() throws Exception {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) throw new RuntimeException("no_sensor_manager");
        JSONArray arr = new JSONArray();
        for (Sensor s : sm.getSensorList(Sensor.TYPE_ALL)) {
            JSONObject o = new JSONObject();
            try {
                o.put("name", s.getName());
                o.put("vendor", s.getVendor());
                o.put("version", s.getVersion());
                o.put("type", s.getType());
                o.put("typeString", s.getStringType());
                o.put("maxRange", (double) s.getMaximumRange());
                o.put("resolution", (double) s.getResolution());
                o.put("power_mA", (double) s.getPower());
                o.put("minDelay_us", s.getMinDelay());
                o.put("maxDelay_us", s.getMaxDelay());
                o.put("reportingMode", s.getReportingMode());
                o.put("wakeUp", s.isWakeUpSensor());
                o.put("dynamic", s.isDynamicSensor());
            } catch (Throwable ignored) {}
            arr.put(o);
        }
        return arr.toString();
    }

    @Override
    public String sensorRead(String name, int ms) throws Exception {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) throw new RuntimeException("no_sensor_manager");
        Sensor target = null;
        for (Sensor s : sm.getSensorList(Sensor.TYPE_ALL)) {
            if (s.getName().equalsIgnoreCase(name)
                    || s.getStringType().equalsIgnoreCase(name)
                    || s.getStringType().toLowerCase().endsWith(name.toLowerCase())) {
                target = s; break;
            }
        }
        if (target == null) throw new RuntimeException("sensor_not_found: " + name);

        final JSONArray readings = new JSONArray();
        final SensorEventListener listener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) {
                try {
                    JSONArray vals = new JSONArray();
                    for (float v : e.values) vals.put((double) v);
                    JSONObject r = new JSONObject();
                    r.put("ts_ns", e.timestamp);
                    r.put("values", vals);
                    if (e.accuracy >= 0) r.put("accuracy", e.accuracy);
                    readings.put(r);
                } catch (Throwable ignored) {}
            }
            @Override public void onAccuracyChanged(Sensor s, int a) {}
        };

        sm.registerListener(listener, target, SensorManager.SENSOR_DELAY_FASTEST);
        try { Thread.sleep(Math.max(50, Math.min(ms, 10000))); }
        finally { sm.unregisterListener(listener); }

        return new JSONObject()
            .put("sensor", target.getName())
            .put("type", target.getStringType())
            .put("readings", readings)
            .toString();
    }

    @Override
    public String systemInfo() throws Exception {
        JSONObject o = new JSONObject();
        o.put("cpuCores", Runtime.getRuntime().availableProcessors());
        o.put("cpuAbi", String.join(",", Build.SUPPORTED_ABIS));
        o.put("cpuAbi64", String.join(",", Build.SUPPORTED_64_BIT_ABIS));
        o.put("cpuAbi32", String.join(",", Build.SUPPORTED_32_BIT_ABIS));

        android.app.ActivityManager am = (android.app.ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            JSONObject m = new JSONObject();
            m.put("totalBytes", mi.totalMem);
            m.put("availableBytes", mi.availMem);
            m.put("lowMemory", mi.lowMemory);
            m.put("thresholdBytes", mi.threshold);
            o.put("ram", m);
        }

        JSONObject time = new JSONObject();
        time.put("uptimeMs", SystemClock.elapsedRealtime());
        time.put("sinceBootMs", SystemClock.uptimeMillis());
        time.put("wallMs", System.currentTimeMillis());
        o.put("time", time);

        JSONObject build = new JSONObject();
        try { build.put("brand", Build.BRAND); } catch (Throwable ignored) {}
        try { build.put("manufacturer", Build.MANUFACTURER); } catch (Throwable ignored) {}
        try { build.put("model", Build.MODEL); } catch (Throwable ignored) {}
        try { build.put("device", Build.DEVICE); } catch (Throwable ignored) {}
        try { build.put("product", Build.PRODUCT); } catch (Throwable ignored) {}
        try { build.put("board", Build.BOARD); } catch (Throwable ignored) {}
        try { build.put("hardware", Build.HARDWARE); } catch (Throwable ignored) {}
        try { build.put("fingerprint", Build.FINGERPRINT); } catch (Throwable ignored) {}
        try { build.put("displayId", Build.DISPLAY); } catch (Throwable ignored) {}
        try { build.put("host", Build.HOST); } catch (Throwable ignored) {}
        try { build.put("user", Build.USER); } catch (Throwable ignored) {}
        try { build.put("tags", Build.TAGS); } catch (Throwable ignored) {}
        try { build.put("type", Build.TYPE); } catch (Throwable ignored) {}
        try { build.put("bootloader", Build.BOOTLOADER); } catch (Throwable ignored) {}
        try { build.put("radioVersion", Build.getRadioVersion()); } catch (Throwable ignored) {}
        try { build.put("sdkInt", Build.VERSION.SDK_INT); } catch (Throwable ignored) {}
        try { build.put("release", Build.VERSION.RELEASE); } catch (Throwable ignored) {}
        try { build.put("codename", Build.VERSION.CODENAME); } catch (Throwable ignored) {}
        try { build.put("incremental", Build.VERSION.INCREMENTAL); } catch (Throwable ignored) {}
        try { build.put("securityPatch", Build.VERSION.SECURITY_PATCH); } catch (Throwable ignored) {}
        try { build.put("previewSdk", Build.VERSION.PREVIEW_SDK_INT); } catch (Throwable ignored) {}
        o.put("build", build);

        return o.toString();
    }

    @Override
    public String storageInfo() throws Exception {
        JSONObject o = new JSONObject();

        StatFs data = new StatFs(Environment.getDataDirectory().getAbsolutePath());
        JSONObject internal = new JSONObject();
        internal.put("path", Environment.getDataDirectory().getAbsolutePath());
        internal.put("totalBytes", data.getTotalBytes());
        internal.put("freeBytes", data.getAvailableBytes());
        internal.put("usedBytes", data.getTotalBytes() - data.getAvailableBytes());
        o.put("internal", internal);

        JSONArray volumes = new JSONArray();
        StorageManager sm = (StorageManager) ctx.getSystemService(Context.STORAGE_SERVICE);
        if (sm != null) {
            for (StorageVolume v : sm.getStorageVolumes()) {
                try {
                    JSONObject vo = new JSONObject();
                    vo.put("description", v.getDescription(ctx));
                    vo.put("isPrimary", v.isPrimary());
                    vo.put("isRemovable", v.isRemovable());
                    if (Build.VERSION.SDK_INT >= 30) {
                        vo.put("state", v.getState());
                        vo.put("uuid", v.getUuid());
                    }
                    if (Build.VERSION.SDK_INT >= 30 && v.getDirectory() != null) {
                        try {
                            StatFs fs = new StatFs(v.getDirectory().getAbsolutePath());
                            vo.put("totalBytes", fs.getTotalBytes());
                            vo.put("freeBytes", fs.getAvailableBytes());
                        } catch (Throwable ignored) {}
                    }
                    volumes.put(vo);
                } catch (Throwable ignored) {}
            }
        }
        o.put("volumes", volumes);

        return o.toString();
    }

    @Override
    public String networkInfo() throws Exception {
        JSONObject o = new JSONObject();

        JSONArray ifaces = new JSONArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                try {
                    JSONObject io = new JSONObject();
                    io.put("name", ni.getName());
                    io.put("up", ni.isUp());
                    io.put("loopback", ni.isLoopback());
                    io.put("virtual", ni.isVirtual());
                    io.put("mtu", ni.getMTU());
                    JSONArray addrs = new JSONArray();
                    for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                        JSONObject ao = new JSONObject();
                        ao.put("address", ia.getAddress().getHostAddress());
                        ao.put("prefixLength", ia.getNetworkPrefixLength());
                        if (ia.getBroadcast() != null)
                            ao.put("broadcast", ia.getBroadcast().getHostAddress());
                        addrs.put(ao);
                    }
                    io.put("addresses", addrs);
                    ifaces.put(io);
                } catch (Throwable ignored) {}
            }
        } catch (Throwable ignored) {}
        o.put("interfaces", ifaces);

        ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null && Build.VERSION.SDK_INT >= 23) {
            try {
                Network n = cm.getActiveNetwork();
                NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                if (caps != null) {
                    JSONObject no = new JSONObject();
                    no.put("wifi", caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
                    no.put("cellular", caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
                    no.put("ethernet", caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
                    no.put("vpn", caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN));
                    no.put("bluetooth", caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH));
                    no.put("downstreamKbps", caps.getLinkDownstreamBandwidthKbps());
                    no.put("upstreamKbps", caps.getLinkUpstreamBandwidthKbps());
                    no.put("validated", caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
                    o.put("active", no);
                }
            } catch (Throwable ignored) {}
        }

        return o.toString();
    }

    @Override
    public String telephonyInfo() throws Exception {
        JSONObject o = new JSONObject();
        TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
        if (tm == null) return o.toString();

        try { o.put("simState", tm.getSimState()); } catch (Throwable ignored) {}
        try { o.put("phoneType", tm.getPhoneType()); } catch (Throwable ignored) {}
        try { o.put("networkOperator", tm.getNetworkOperator()); } catch (Throwable ignored) {}
        try { o.put("networkOperatorName", tm.getNetworkOperatorName()); } catch (Throwable ignored) {}
        try { o.put("simOperator", tm.getSimOperator()); } catch (Throwable ignored) {}
        try { o.put("simOperatorName", tm.getSimOperatorName()); } catch (Throwable ignored) {}
        try { o.put("networkType", tm.getDataNetworkType()); } catch (Throwable ignored) {}
        try { o.put("isNetworkRoaming", tm.isNetworkRoaming()); } catch (Throwable ignored) {}
        try { o.put("isDataEnabled", tm.isDataEnabled()); } catch (Throwable ignored) {}
        try { o.put("simCountryIso", tm.getSimCountryIso()); } catch (Throwable ignored) {}
        try { o.put("networkCountryIso", tm.getNetworkCountryIso()); } catch (Throwable ignored) {}
        try { o.put("simCarrierId", tm.getSimCarrierId()); } catch (Throwable ignored) {}
        try { o.put("simCarrierIdName", String.valueOf(tm.getSimCarrierIdName())); } catch (Throwable ignored) {}
        try { o.put("phoneCount", tm.getPhoneCount()); } catch (Throwable ignored) {}
        try { o.put("isHearingAidCompatibilitySupported", tm.isHearingAidCompatibilitySupported()); } catch (Throwable ignored) {}

        if (Build.VERSION.SDK_INT >= 28) {
            try {
                android.telephony.SignalStrength ss = tm.getSignalStrength();
                if (ss != null) {
                    JSONObject so = new JSONObject();
                    so.put("level", ss.getLevel());
                    so.put("isGsm", ss.isGsm());
                    try { so.put("dbm", ss.getCellSignalStrengths().get(0).getDbm()); } catch (Throwable ignored) {}
                    o.put("signal", so);
                }
            } catch (Throwable ignored) {}
        }

        return o.toString();
    }

    @Override
    public String displayInfo() throws Exception {
        JSONObject o = new JSONObject();
        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return o.toString();
        Display d = wm.getDefaultDisplay();
        DisplayMetrics m = new DisplayMetrics();
        d.getRealMetrics(m);
        o.put("widthPx", m.widthPixels);
        o.put("heightPx", m.heightPixels);
        o.put("densityDpi", m.densityDpi);
        o.put("density", (double) m.density);
        o.put("xdpi", (double) m.xdpi);
        o.put("ydpi", (double) m.ydpi);

        if (Build.VERSION.SDK_INT >= 23) {
            try {
                Display.Mode cur = d.getMode();
                o.put("refreshRateHz", (double) cur.getRefreshRate());
                o.put("modeId", cur.getModeId());
                JSONArray modes = new JSONArray();
                for (Display.Mode mm : d.getSupportedModes()) {
                    modes.put(new JSONObject()
                        .put("id", mm.getModeId())
                        .put("width", mm.getPhysicalWidth())
                        .put("height", mm.getPhysicalHeight())
                        .put("refreshHz", (double) mm.getRefreshRate()));
                }
                o.put("modes", modes);
            } catch (Throwable ignored) {}
        }
        if (Build.VERSION.SDK_INT >= 24) {
            try { o.put("isHdr", d.isHdr()); } catch (Throwable ignored) {}
            try { o.put("isWideColorGamut", d.isWideColorGamut()); } catch (Throwable ignored) {}
        }
        try { o.put("rotation", d.getRotation()); } catch (Throwable ignored) {}
        try { o.put("state", d.getState()); } catch (Throwable ignored) {}

        return o.toString();
    }

    @Override
    public String audioInfo() throws Exception {
        JSONObject o = new JSONObject();
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return o.toString();

        try {
            JSONObject vol = new JSONObject();
            vol.put("music", am.getStreamVolume(AudioManager.STREAM_MUSIC));
            vol.put("musicMax", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            vol.put("ring", am.getStreamVolume(AudioManager.STREAM_RING));
            vol.put("ringMax", am.getStreamMaxVolume(AudioManager.STREAM_RING));
            vol.put("alarm", am.getStreamVolume(AudioManager.STREAM_ALARM));
            vol.put("notification", am.getStreamVolume(AudioManager.STREAM_NOTIFICATION));
            o.put("volumes", vol);
        } catch (Throwable ignored) {}

        try { o.put("isMusicActive", am.isMusicActive()); } catch (Throwable ignored) {}
        try { o.put("isSpeakerphoneOn", am.isSpeakerphoneOn()); } catch (Throwable ignored) {}
        try { o.put("isBluetoothA2dpOn", am.isBluetoothA2dpOn()); } catch (Throwable ignored) {}
        try { o.put("isWiredHeadsetOn", am.isWiredHeadsetOn()); } catch (Throwable ignored) {}
        try { o.put("mode", am.getMode()); } catch (Throwable ignored) {}
        try { o.put("ringerMode", am.getRingerMode()); } catch (Throwable ignored) {}
        try { o.put("sampleRate", am.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)); } catch (Throwable ignored) {}
        try { o.put("framesPerBuffer", am.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)); } catch (Throwable ignored) {}

        if (Build.VERSION.SDK_INT >= 23) {
            try {
                JSONArray arr = new JSONArray();
                for (AudioDeviceInfo ad : am.getDevices(AudioManager.GET_DEVICES_ALL)) {
                    JSONObject adinfo = new JSONObject();
                    adinfo.put("type", ad.getType());
                    adinfo.put("name", ad.getProductName());
                    adinfo.put("isSink", ad.isSink());
                    adinfo.put("isSource", ad.isSource());
                    JSONArray srArr = new JSONArray();
                    for (int r : ad.getSampleRates()) srArr.put(r);
                    adinfo.put("sampleRates", srArr);
                    JSONArray ccArr = new JSONArray();
                    for (int c : ad.getChannelCounts()) ccArr.put(c);
                    adinfo.put("channelCounts", ccArr);
                    arr.put(adinfo);
                }
                o.put("devices", arr);
            } catch (Throwable ignored) {}
        }

        return o.toString();
    }

    @Override
    public String featuresList() throws Exception {
        JSONArray arr = new JSONArray();
        try {
            android.content.pm.PackageManager pm = ctx.getPackageManager();
            FeatureInfo[] feats = pm.getSystemAvailableFeatures();
            if (feats != null) {
                for (FeatureInfo fi : feats) {
                    try {
                        JSONObject o = new JSONObject();
                        if (fi.name != null) o.put("name", fi.name);
                        if (Build.VERSION.SDK_INT >= 24) o.put("version", fi.version);
                        arr.put(o);
                    } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable ignored) {}
        return arr.toString();
    }

    @Override
    public String cameraList() throws Exception {
        CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) throw new RuntimeException("no_camera_manager");
        JSONArray arr = new JSONArray();
        for (String id : cm.getCameraIdList()) {
            try {
                CameraCharacteristics cc = cm.getCameraCharacteristics(id);
                JSONObject o = new JSONObject();
                o.put("id", id);
                Object flash = cc.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (flash != null) o.put("flash", flash);
                Object facing = cc.get(CameraCharacteristics.LENS_FACING);
                if (facing != null) o.put("lensFacing", facing);
                Object orient = cc.get(CameraCharacteristics.SENSOR_ORIENTATION);
                if (orient != null) o.put("sensorOrientation", orient);

                try {
                    android.util.SizeF sz = cc.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
                    if (sz != null) {
                        o.put("sensorWidthMm", (double) sz.getWidth());
                        o.put("sensorHeightMm", (double) sz.getHeight());
                    }
                } catch (Throwable ignored) {}
                try {
                    android.util.Size pix = cc.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE);
                    if (pix != null) {
                        o.put("pixelArrayWidth", pix.getWidth());
                        o.put("pixelArrayHeight", pix.getHeight());
                    }
                } catch (Throwable ignored) {}
                try {
                    float[] fs = cc.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
                    if (fs != null) {
                        JSONArray fsa = new JSONArray();
                        for (float f : fs) fsa.put((double) f);
                        o.put("focalLengthsMm", fsa);
                    }
                } catch (Throwable ignored) {}
                try {
                    float[] ap = cc.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES);
                    if (ap != null) {
                        JSONArray apa = new JSONArray();
                        for (float a : ap) apa.put((double) a);
                        o.put("aperturesF", apa);
                    }
                } catch (Throwable ignored) {}
                try {
                    android.util.Range<Integer> iso = cc.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE);
                    if (iso != null) {
                        o.put("isoMin", iso.getLower());
                        o.put("isoMax", iso.getUpper());
                    }
                } catch (Throwable ignored) {}
                try {
                    long expo = cc.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE).getUpper();
                    o.put("maxExposureNs", expo);
                } catch (Throwable ignored) {}

                android.hardware.camera2.params.StreamConfigurationMap scm =
                        cc.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
                if (scm != null) {
                    android.util.Size[] sizes = scm.getOutputSizes(android.graphics.ImageFormat.JPEG);
                    if (sizes != null) {
                        JSONArray sa = new JSONArray();
                        for (android.util.Size s : sizes)
                            sa.put(new JSONObject().put("w", s.getWidth()).put("h", s.getHeight()));
                        o.put("jpegSizes", sa);
                    }
                }
                arr.put(o);
            } catch (Throwable ignored) {}
        }
        return arr.toString();
    }

    @Override
    public String batteryDetailed() throws Exception {
        JSONObject o = new JSONObject();
        android.content.IntentFilter f = new android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED);
        android.content.Intent b = ctx.registerReceiver(null, f);
        if (b == null) return o.toString();
        int level = b.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
        int scale = b.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, 100);
        o.put("level", level);
        o.put("scale", scale);
        if (scale > 0) o.put("percentage", (int)(100.0 * level / scale));
        o.put("status", b.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1));
        o.put("health", b.getIntExtra(android.os.BatteryManager.EXTRA_HEALTH, -1));
        o.put("plugged", b.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, -1));
        o.put("voltage_mV", b.getIntExtra(android.os.BatteryManager.EXTRA_VOLTAGE, -1));
        o.put("temperature_tenth_C", b.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE, -1));
        o.put("technology", b.getStringExtra(android.os.BatteryManager.EXTRA_TECHNOLOGY));
        o.put("present", b.getBooleanExtra(android.os.BatteryManager.EXTRA_PRESENT, false));
        try {
            android.os.BatteryManager bm = (android.os.BatteryManager)
                    ctx.getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                o.put("current_uA", bm.getLongProperty(android.os.BatteryManager.BATTERY_PROPERTY_CURRENT_NOW));
                o.put("chargeCounter_uAh", bm.getLongProperty(android.os.BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER));
                o.put("capacity", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY));
            }
        } catch (Throwable ignored) {}
        return o.toString();
    }

    @Override
    public String locationDetailed() throws Exception {
        need(Manifest.permission.ACCESS_FINE_LOCATION);
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) throw new RuntimeException("no_location_manager");
        JSONObject o = new JSONObject();

        try { o.put("isProviderEnabled", lm.isProviderEnabled(LocationManager.GPS_PROVIDER)); } catch (Throwable ignored) {}

        JSONArray provs = new JSONArray();
        for (String p : lm.getProviders(true)) {
            try {
                JSONObject po = new JSONObject();
                po.put("name", p);
                if (Build.VERSION.SDK_INT >= 28) {
                    try { po.put("enabled", lm.isProviderEnabled(p)); } catch (Throwable ignored) {}
                }
                android.location.Location l = null;
                try { l = lm.getLastKnownLocation(p); } catch (SecurityException e) { continue; }
                if (l != null) {
                    po.put("lat", l.getLatitude());
                    po.put("lon", l.getLongitude());
                    po.put("alt", l.getAltitude());
                    po.put("accuracy", l.getAccuracy());
                    po.put("speed_mps", l.getSpeed());
                    po.put("bearing_deg", l.getBearing());
                    po.put("provider", l.getProvider());
                    po.put("ts_ms", l.getTime());
                    if (Build.VERSION.SDK_INT >= 26) {
                        po.put("speedAccuracy", l.getSpeedAccuracyMetersPerSecond());
                        po.put("bearingAccuracy", l.getBearingAccuracyDegrees());
                        po.put("verticalAccuracy", l.getVerticalAccuracyMeters());
                    }
                }
                provs.put(po);
            } catch (Throwable ignored) {}
        }
        o.put("providers", provs);

        return o.toString();
    }

    @Override
    public String localeInfo() throws Exception {
        JSONObject o = new JSONObject();
        o.put("locale", Locale.getDefault().toString());
        o.put("language", Locale.getDefault().getLanguage());
        o.put("country", Locale.getDefault().getCountry());
        o.put("timezone", TimeZone.getDefault().getID());
        o.put("timezoneOffsetMs", TimeZone.getDefault().getOffset(System.currentTimeMillis()));
        o.put("nowMs", System.currentTimeMillis());
        o.put("is24Hour", android.text.format.DateFormat.is24HourFormat(ctx));
        return o.toString();
    }

    private String readFile(String path) {
        try (BufferedReader r = new BufferedReader(new FileReader(path))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append("\n");
            return sb.toString().trim();
        } catch (Throwable t) {
            return null;
        }
    }


    // ─── Patch 36 ──────────────────────────────────────────

    @Override
    public String cpuDetail() throws Exception {
        JSONObject o = new JSONObject();
        int cores = Runtime.getRuntime().availableProcessors();
        o.put("cores", cores);

        JSONArray perCore = new JSONArray();
        for (int i = 0; i < cores; i++) {
            try {
                JSONObject c = new JSONObject();
                c.put("id", i);
                String base = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/";
                String cur = readFile(base + "scaling_cur_freq");
                if (cur != null) c.put("curKhz", Long.parseLong(cur.trim()));
                String min = readFile(base + "cpuinfo_min_freq");
                if (min != null) c.put("minKhz", Long.parseLong(min.trim()));
                String max = readFile(base + "cpuinfo_max_freq");
                if (max != null) c.put("maxKhz", Long.parseLong(max.trim()));
                String gov = readFile(base + "scaling_governor");
                if (gov != null) c.put("governor", gov);
                perCore.put(c);
            } catch (Throwable ignored) {}
        }
        o.put("perCore", perCore);

        String loadavg = readFile("/proc/loadavg");
        if (loadavg != null) o.put("loadAverage", loadavg.split("\\s+"));

        String uptime = readFile("/proc/uptime");
        if (uptime != null) {
            String[] p = uptime.split("\\s+");
            if (p.length > 0) o.put("uptimeSec", Double.parseDouble(p[0]));
        }
        return o.toString();
    }

    @Override
    public String thermalInfo() throws Exception {
        JSONArray arr = new JSONArray();
        File base = new File("/sys/class/thermal");
        File[] zones = base.listFiles((d, n) -> n.startsWith("thermal_zone"));
        if (zones != null) {
            for (File z : zones) {
                try {
                    String type = readFile(z.getAbsolutePath() + "/type");
                    String temp = readFile(z.getAbsolutePath() + "/temp");
                    if (type != null && temp != null) {
                        JSONObject o = new JSONObject();
                        o.put("zone", z.getName());
                        o.put("type", type.trim());
                        double t = Double.parseDouble(temp.trim()) / 1000.0;
                        o.put("temp_c", t);
                        arr.put(o);
                    }
                } catch (Throwable ignored) {}
            }
        }
        return arr.toString();
    }

    @Override
    public String memoryDetail() throws Exception {
        JSONObject o = new JSONObject();
        String meminfo = readFile("/proc/meminfo");
        if (meminfo != null) {
            JSONObject kv = new JSONObject();
            for (String line : meminfo.split("\n")) {
                try {
                    int idx = line.indexOf(':');
                    if (idx < 0) continue;
                    String key = line.substring(0, idx).trim();
                    String val = line.substring(idx + 1).trim();
                    // value is like "12345 kB"
                    String num = val.split("\\s+")[0];
                    if (num.matches("\\d+")) {
                        kv.put(key, Long.parseLong(num) * 1024);
                    }
                } catch (Throwable ignored) {}
            }
            o.put("meminfo", kv);
        }
        return o.toString();
    }

    @Override
    public String wifiDetailed() throws Exception {
        JSONObject o = new JSONObject();
        WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm == null) throw new RuntimeException("no_wifi");
        WifiInfo info = wm.getConnectionInfo();
        if (info == null) throw new RuntimeException("no_wifi_info");

        try { o.put("ssid", String.valueOf(info.getSSID())); } catch (Throwable ignored) {}
        try { o.put("bssid", String.valueOf(info.getBSSID())); } catch (Throwable ignored) {}
        try { o.put("rssi", info.getRssi()); } catch (Throwable ignored) {}
        try { o.put("linkSpeed_mbps", info.getLinkSpeed()); } catch (Throwable ignored) {}
        if (Build.VERSION.SDK_INT >= 21) {
            try { o.put("frequency_mhz", info.getFrequency()); } catch (Throwable ignored) {}
            try { o.put("hiddenSSID", info.getHiddenSSID()); } catch (Throwable ignored) {}
        }
        if (Build.VERSION.SDK_INT >= 29) {
            try { o.put("wifiStandard", info.getWifiStandard()); } catch (Throwable ignored) {}
            try { o.put("maxSupportedRxKbps", info.getMaxSupportedRxLinkSpeedMbps()); } catch (Throwable ignored) {}
            try { o.put("maxSupportedTxKbps", info.getMaxSupportedTxLinkSpeedMbps()); } catch (Throwable ignored) {}
            try { o.put("currentRxKbps", info.getRxLinkSpeedMbps()); } catch (Throwable ignored) {}
            try { o.put("currentTxKbps", info.getTxLinkSpeedMbps()); } catch (Throwable ignored) {}
        }
        try { o.put("ipAddress", info.getIpAddress()); } catch (Throwable ignored) {}
        try { o.put("macAddress", info.getMacAddress()); } catch (Throwable ignored) {}
        try { o.put("networkId", info.getNetworkId()); } catch (Throwable ignored) {}
        try { o.put("supplicantState", String.valueOf(info.getSupplicantState())); } catch (Throwable ignored) {}
        try { o.put("wifiEnabled", wm.isWifiEnabled()); } catch (Throwable ignored) {}

        return o.toString();
    }

    @Override
    public String bluetoothInfo() throws Exception {
        JSONObject o = new JSONObject();
        BluetoothAdapter ba = BluetoothAdapter.getDefaultAdapter();
        if (ba == null) {
            o.put("available", false);
            return o.toString();
        }
        o.put("available", true);
        try { o.put("enabled", ba.isEnabled()); } catch (Throwable ignored) {}
        try { o.put("state", ba.getState()); } catch (Throwable ignored) {}
        try { o.put("name", ba.getName()); } catch (Throwable t) { o.put("nameError", "permission_required: BLUETOOTH_CONNECT"); }
        try { o.put("address", ba.getAddress()); } catch (Throwable t) {}

        JSONArray devices = new JSONArray();
        try {
            Set<BluetoothDevice> bonded = ba.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice d : bonded) {
                    try {
                        JSONObject dj = new JSONObject();
                        try { dj.put("name", d.getName()); } catch (Throwable ignored) {}
                        try { dj.put("address", d.getAddress()); } catch (Throwable ignored) {}
                        try { dj.put("type", d.getType()); } catch (Throwable ignored) {}
                        try { dj.put("bondState", d.getBondState()); } catch (Throwable ignored) {}
                        if (Build.VERSION.SDK_INT >= 30) {
                            try { dj.put("bluetoothClass", String.valueOf(d.getBluetoothClass())); } catch (Throwable ignored) {}
                        }
                        devices.put(dj);
                    } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable t) {
            o.put("bondedError", "permission_required: BLUETOOTH_CONNECT");
        }
        o.put("bondedDevices", devices);

        return o.toString();
    }

    @Override
    public String displayBrightness() throws Exception {
        JSONObject o = new JSONObject();
        try {
            int cur = Settings.System.getInt(ctx.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS);
            o.put("current", cur);
        } catch (Throwable ignored) {}
        try {
            int mode = Settings.System.getInt(ctx.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE);
            o.put("mode", mode);  // 0=manual, 1=auto
            o.put("modeString", mode == 1 ? "auto" : "manual");
        } catch (Throwable ignored) {}
        o.put("max", 255);
        o.put("canWrite", false);  // always false unless WRITE_SETTINGS granted
        return o.toString();
    }

    @Override
    public String displayColor() throws Exception {
        JSONObject o = new JSONObject();
        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return o.toString();
        Display d = wm.getDefaultDisplay();

        try {
            Display.Mode cur = d.getMode();
            o.put("currentModeId", cur.getModeId());
            o.put("currentWidth", cur.getPhysicalWidth());
            o.put("currentHeight", cur.getPhysicalHeight());
            o.put("currentRefreshHz", (double) cur.getRefreshRate());
        } catch (Throwable ignored) {}

        if (Build.VERSION.SDK_INT >= 26) {
            try { o.put("isWideColorGamut", d.isWideColorGamut()); } catch (Throwable ignored) {}
            try { o.put("isHdr", d.isHdr()); } catch (Throwable ignored) {}
        }

        if (Build.VERSION.SDK_INT >= 24) {
            try {
                Display.HdrCapabilities hdr = d.getHdrCapabilities();
                if (hdr != null) {
                    JSONArray types = new JSONArray();
                    for (int t : hdr.getSupportedHdrTypes()) types.put(t);
                    o.put("hdrTypes", types);
                    o.put("maxLuminance", (double) hdr.getDesiredMaxLuminance());
                    o.put("maxAverageLuminance", (double) hdr.getDesiredMaxAverageLuminance());
                    o.put("minLuminance", (double) hdr.getDesiredMinLuminance());
                }
            } catch (Throwable ignored) {}
        }

        try {
            int night = Settings.Secure.getInt(ctx.getContentResolver(), "ui_night_mode");
            o.put("nightMode", night);
        } catch (Throwable ignored) {}

        return o.toString();
    }

    @Override
    public String microphoneList() throws Exception {
        JSONArray arr = new JSONArray();
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return arr.toString();

        if (Build.VERSION.SDK_INT >= 23) {
            for (AudioDeviceInfo ad : am.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", ad.getId());
                    o.put("type", ad.getType());
                    o.put("name", ad.getProductName());
                    o.put("isSource", ad.isSource());
                    o.put("isSink", ad.isSink());
                    JSONArray sr = new JSONArray();
                    for (int r : ad.getSampleRates()) sr.put(r);
                    o.put("sampleRates", sr);
                    JSONArray cc = new JSONArray();
                    for (int c : ad.getChannelCounts()) cc.put(c);
                    o.put("channelCounts", cc);
                    JSONArray enc = new JSONArray();
                    for (int e : ad.getEncodings()) enc.put(e);
                    o.put("encodings", enc);
                    arr.put(o);
                } catch (Throwable ignored) {}
            }
        }
        return arr.toString();
    }

    @Override
    public String kernelInfo() throws Exception {
        JSONObject o = new JSONObject();
        try { o.put("os_version", System.getProperty("os.version")); } catch (Throwable ignored) {}
        try { o.put("os_name", System.getProperty("os.name")); } catch (Throwable ignored) {}
        try { o.put("os_arch", System.getProperty("os.arch")); } catch (Throwable ignored) {}
        try { o.put("java_version", System.getProperty("java.version")); } catch (Throwable ignored) {}
        try { o.put("java_vm", System.getProperty("java.vm.name")); } catch (Throwable ignored) {}

        String proc = readFile("/proc/version");
        if (proc != null) o.put("proc_version", proc);
        String uptime = readFile("/proc/uptime");
        if (uptime != null) {
            String[] p = uptime.split("\\s+");
            if (p.length > 0) {
                double up = Double.parseDouble(p[0]);
                o.put("uptimeSec", up);
                o.put("bootTimeUnixMs", System.currentTimeMillis() - (long)(up * 1000));
            }
        }
        return o.toString();
    }


    @Override
    public String cameraPhoto(String path) throws Exception {
        need(Manifest.permission.CAMERA);
        final java.io.File outFile;
        if (path == null || path.isEmpty() || !path.startsWith("/")) {
            java.io.File d = new java.io.File(ctx.getFilesDir(), "photos");
            d.mkdirs();
            outFile = new java.io.File(d, "img_" + System.currentTimeMillis() + ".jpg");
        } else {
            java.io.File candidate = new java.io.File(path).getCanonicalFile();
            String cp = candidate.getPath();
            boolean allowed = cp.startsWith("/sdcard/")
                    || cp.startsWith("/storage/emulated/0/")
                    || cp.startsWith("/storage/self/primary/")
                    || cp.startsWith("/data/data/dev.mtapi/")
                    || cp.startsWith("/data/user/0/dev.mtapi/");
            if (!allowed) throw new SecurityException("path_not_allowed: " + cp);
            outFile = candidate;
            java.io.File p = outFile.getParentFile();
            if (p != null) p.mkdirs();
        }

        android.hardware.camera2.CameraManager cm =
                (android.hardware.camera2.CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) throw new RuntimeException("no_camera_manager");

        String[] ids = cm.getCameraIdList();
        if (ids.length == 0) throw new RuntimeException("no_cameras");

        String camId = null;
        for (String id : ids) {
            Integer facing = cm.getCameraCharacteristics(id)
                    .get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);
            if (facing != null && facing == android.hardware.camera2.CameraCharacteristics.LENS_FACING_BACK) {
                camId = id; break;
            }
        }
        if (camId == null) camId = ids[0];

        android.hardware.camera2.CameraCharacteristics chars =
                cm.getCameraCharacteristics(camId);
        android.hardware.camera2.params.StreamConfigurationMap scm =
                chars.get(android.hardware.camera2.CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        android.util.Size size = new android.util.Size(1920, 1080);
        if (scm != null) {
            android.util.Size[] sizes = scm.getOutputSizes(android.graphics.ImageFormat.JPEG);
            if (sizes != null && sizes.length > 0) {
                android.util.Size best = sizes[0];
                for (android.util.Size s : sizes) {
                    long a = (long) s.getWidth() * s.getHeight();
                    long b = (long) best.getWidth() * best.getHeight();
                    if (a > b && a <= 1920L * 1080 * 4) { best = s; }
                }
                size = best;
            }
        }

        final java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.atomic.AtomicReference<Throwable> errRef =
                new java.util.concurrent.atomic.AtomicReference<>();

        android.media.ImageReader reader = android.media.ImageReader.newInstance(
                size.getWidth(), size.getHeight(),
                android.graphics.ImageFormat.JPEG, 2);

        reader.setOnImageAvailableListener(r -> {
            android.media.Image img = null;
            try {
                img = r.acquireLatestImage();
                if (img == null) return;
                java.nio.ByteBuffer buf = img.getPlanes()[0].getBuffer();
                byte[] bytes = new byte[buf.remaining()];
                buf.get(bytes);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(outFile)) {
                    fos.write(bytes);
                }
            } catch (Throwable t) {
                errRef.set(t);
            } finally {
                if (img != null) try { img.close(); } catch (Throwable ignored) {}
                latch.countDown();
            }
        }, null);

        cm.openCamera(camId, new android.hardware.camera2.CameraDevice.StateCallback() {
            @Override public void onOpened(android.hardware.camera2.CameraDevice camera) {
                try {
                    camera.createCaptureSession(
                            java.util.Collections.singletonList(reader.getSurface()),
                            new android.hardware.camera2.CameraCaptureSession.StateCallback() {
                                @Override public void onConfigured(android.hardware.camera2.CameraCaptureSession session) {
                                    try {
                                        android.hardware.camera2.CaptureRequest.Builder b =
                                                camera.createCaptureRequest(
                                                        android.hardware.camera2.CameraDevice.TEMPLATE_STILL_CAPTURE);
                                        b.addTarget(reader.getSurface());
                                        b.set(android.hardware.camera2.CaptureRequest.CONTROL_MODE,
                                                android.hardware.camera2.CameraMetadata.CONTROL_MODE_AUTO);
                                        session.capture(b.build(), null, null);
                                    } catch (Throwable t) {
                                        errRef.set(t); latch.countDown();
                                    }
                                }
                                @Override public void onConfigureFailed(android.hardware.camera2.CameraCaptureSession session) {
                                    errRef.set(new RuntimeException("configure_failed"));
                                    latch.countDown();
                                }
                            }, null);
                } catch (Throwable t) {
                    errRef.set(t); latch.countDown();
                }
            }
            @Override public void onDisconnected(android.hardware.camera2.CameraDevice camera) {
                errRef.set(new RuntimeException("disconnected")); latch.countDown();
            }
            @Override public void onError(android.hardware.camera2.CameraDevice camera, int error) {
                errRef.set(new RuntimeException("camera_error_" + error)); latch.countDown();
            }
        }, null);

        try {
            if (!latch.await(30, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new RuntimeException("camera_timeout");
            }
            if (errRef.get() != null) {
                throw new RuntimeException("camera: " + errRef.get().getMessage());
            }
            if (!outFile.exists() || outFile.length() == 0) {
                throw new RuntimeException("camera: empty_file");
            }
            return outFile.getAbsolutePath() + " (" + outFile.length() + " bytes)";
        } finally {
            try { reader.close(); } catch (Throwable ignored) {}
        }
    }

    @Override
    public String microphoneRecord(String path, int seconds) throws Exception {
        need(Manifest.permission.RECORD_AUDIO);
        final java.io.File outFile;
        if (path == null || path.isEmpty() || !path.startsWith("/")) {
            java.io.File d = new java.io.File(ctx.getFilesDir(), "audio");
            d.mkdirs();
            outFile = new java.io.File(d, "rec_" + System.currentTimeMillis() + ".m4a");
        } else {
            java.io.File candidate = new java.io.File(path).getCanonicalFile();
            String cp = candidate.getPath();
            boolean allowed = cp.startsWith("/sdcard/")
                    || cp.startsWith("/storage/emulated/0/")
                    || cp.startsWith("/storage/self/primary/")
                    || cp.startsWith("/data/data/dev.mtapi/")
                    || cp.startsWith("/data/user/0/dev.mtapi/");
            if (!allowed) throw new SecurityException("path_not_allowed: " + cp);
            outFile = candidate;
            java.io.File p = outFile.getParentFile();
            if (p != null) p.mkdirs();
        }
        if (seconds <= 0) seconds = 5;
        if (seconds > 60) seconds = 60;

        android.media.MediaRecorder mr = new android.media.MediaRecorder();
        try {
            mr.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
            mr.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4);
            mr.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
            mr.setAudioChannels(1);
            mr.setAudioSamplingRate(44100);
            mr.setAudioEncodingBitRate(96000);
            mr.setOutputFile(outFile.getAbsolutePath());
            mr.prepare();
            mr.start();
            Thread.sleep(seconds * 1000L);
            mr.stop();
            return outFile.getAbsolutePath() + " (" + outFile.length() + " bytes)";
        } catch (Throwable t) {
            try { mr.reset(); } catch (Throwable ignored) {}
            throw new RuntimeException("record_failed: " + t.getMessage());
        } finally {
            try { mr.release(); } catch (Throwable ignored) {}
        }
    }

    @Override
    public String torchBrightness(int level) throws Exception {
        android.hardware.camera2.CameraManager cm =
                (android.hardware.camera2.CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) throw new RuntimeException("no_camera_manager");
        if (level < 0) level = 0;
        if (level > 100) level = 100;

        String flashId = null;
        android.hardware.camera2.CameraCharacteristics flashChars = null;
        for (String id : cm.getCameraIdList()) {
            android.hardware.camera2.CameraCharacteristics cc = cm.getCameraCharacteristics(id);
            Boolean flash = cc.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE);
            if (flash != null && flash) {
                flashId = id; flashChars = cc; break;
            }
        }
        if (flashId == null) throw new RuntimeException("no_flash");

        JSONObject o = new JSONObject();
        o.put("level", level);

        if (Build.VERSION.SDK_INT >= 33) {
            Integer maxLvl = flashChars.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_STRENGTH_MAXIMUM_LEVEL);
            Integer defLvl = flashChars.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_STRENGTH_DEFAULT_LEVEL);
            int max = (maxLvl != null && maxLvl > 0) ? maxLvl : 1;
            o.put("max", max);
            o.put("default", defLvl != null ? defLvl : 1);
            if (level == 0) {
                cm.setTorchMode(flashId, false);
                o.put("on", false);
            } else {
                int actual = Math.max(1, (level * max) / 100);
                cm.turnOnTorchWithStrengthLevel(flashId, actual);
                o.put("actual", actual);
                o.put("on", true);
            }
            o.put("supportsStrength", max > 1);
        } else {
            if (level > 0) {
                cm.setTorchMode(flashId, true);
                o.put("on", true);
            } else {
                cm.setTorchMode(flashId, false);
                o.put("on", false);
            }
            o.put("supportsStrength", false);
            o.put("note", "API<33: on/off only");
        }
        return o.toString();
    }

    // ── Patch 42: universal features ──────────────────────

    @Override
    public String sensorStreamStart(String name, int hz) throws Exception {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) throw new RuntimeException("no_sensor_manager");
        Sensor target = null;
        for (Sensor s : sm.getSensorList(Sensor.TYPE_ALL)) {
            String st = s.getStringType() == null ? "" : s.getStringType();
            if (s.getName().equalsIgnoreCase(name) || st.equalsIgnoreCase(name)
                    || st.toLowerCase().endsWith("." + name.toLowerCase())) {
                target = s; break;
            }
        }
        if (target == null) throw new RuntimeException("sensor_not_found: " + name);
        if (hz <= 0) hz = 20;
        if (hz > 200) hz = 200;
        final int delayUs = 1000000 / hz;

        // sensor_key_normalize: use stable getStringType()/getName() as key
        final String key = (target.getStringType() == null || target.getStringType().isEmpty())
                ? target.getName() : target.getStringType();
        if (sseRegistry.containsKey(key)) return "already_streaming";

        final SensorEventListener[] self = new SensorEventListener[1];
        self[0] = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) {
                // privacy: sensor data not logged to logcat (security audit B.4)
            }
            @Override public void onAccuracyChanged(Sensor s, int a) {}
        };
        sseRegistry.put(key, self[0]);
        sm.registerListener(self[0], target, delayUs);
        return new JSONObject()
            .put("streaming", true)
            .put("sensor", target.getName())
            .put("hz", hz)
            .put("delay_us", delayUs)
            .toString();
    }

    @Override
    public String sensorStreamStop(String name) throws Exception {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) return "no_sensor_manager";
        // sensor_key_normalize: same key derivation as start
        String normKey = name;
        if (name != null && !name.isEmpty()) {
            for (Sensor sensor : sm.getSensorList(Sensor.TYPE_ALL)) {
                String st = sensor.getStringType() == null ? "" : sensor.getStringType();
                if (sensor.getName().equalsIgnoreCase(name)
                        || st.equalsIgnoreCase(name)
                        || st.toLowerCase().endsWith("." + name.toLowerCase())) {
                    normKey = st.isEmpty() ? sensor.getName() : st;
                    break;
                }
            }
        }
        SensorEventListener l = sseRegistry.remove(normKey);
        if (l == null) l = sseRegistry.remove(name);
        if (l == null) return "not_streaming";
        sm.unregisterListener(l);
        return "stopped";
    }

    @Override
    public String audioVolume(int stream) throws Exception {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) throw new RuntimeException("no_audio_manager");
        int s = mapStream(stream);
        return new JSONObject()
            .put("stream", s)
            .put("level", am.getStreamVolume(s))
            .put("max", am.getStreamMaxVolume(s))
            .put("min", am.getStreamMinVolume(s))
            .toString();
    }

    @Override
    public String audioVolumeSet(int stream, int level) throws Exception {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) throw new RuntimeException("no_audio_manager");
        int s = mapStream(stream);
        int max = am.getStreamMaxVolume(s);
        if (level < 0) level = 0;
        if (level > max) level = max;
        am.setStreamVolume(s, level, 0);
        return new JSONObject().put("stream", s).put("level", level).put("max", max).toString();
    }

    @Override
    public String audioRinger() throws Exception {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) throw new RuntimeException("no_audio_manager");
        int m = am.getRingerMode();
        String str = m == AudioManager.RINGER_MODE_SILENT ? "silent"
                   : m == AudioManager.RINGER_MODE_VIBRATE ? "vibrate"
                   : "normal";
        return new JSONObject().put("mode", m).put("modeString", str).toString();
    }

    @Override
    public String audioRingerSet(String mode) throws Exception {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) throw new RuntimeException("no_audio_manager");
        int m;
        switch (mode) {
            case "silent":  m = AudioManager.RINGER_MODE_SILENT;  break;
            case "vibrate": m = AudioManager.RINGER_MODE_VIBRATE; break;
            case "normal":  m = AudioManager.RINGER_MODE_NORMAL;  break;
            default: throw new RuntimeException("bad_mode: " + mode);
        }
        am.setRingerMode(m);
        return new JSONObject().put("mode", m).put("modeString", mode).toString();
    }

    @Override
    public String wifiScan() throws Exception {
        WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm == null) throw new RuntimeException("no_wifi");
        if (!wm.isWifiEnabled()) return "[]";

        try { wm.startScan(); } catch (Throwable ignored) {}
        Thread.sleep(500);

        java.util.List<android.net.wifi.ScanResult> results = null;
        try {
            results = wm.getScanResults();
        } catch (Throwable t) {
            throw new RuntimeException("scan_failed: " + t.getMessage()
                    + " (need ACCESS_FINE_LOCATION + location enabled)");
        }

        JSONArray arr = new JSONArray();
        if (results != null) {
            for (android.net.wifi.ScanResult r : results) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("ssid", r.SSID);
                    o.put("bssid", r.BSSID);
                    o.put("rssi", r.level);
                    o.put("freq_mhz", r.frequency);
                    if (Build.VERSION.SDK_INT >= 30) {
                        try { o.put("wifiStandard", r.getWifiStandard()); } catch (Throwable ignored) {}
                    }
                    arr.put(o);
                } catch (Throwable ignored) {}
            }
        }
        return arr.toString();
    }

    @Override
    public String appList() throws Exception {
        android.content.pm.PackageManager pm = ctx.getPackageManager();
        JSONArray arr = new JSONArray();
        for (android.content.pm.ApplicationInfo ai : pm.getInstalledApplications(0)) {
            try {
                JSONObject o = new JSONObject();
                o.put("pkg", ai.packageName);
                o.put("name", String.valueOf(pm.getApplicationLabel(ai)));
                o.put("system", (ai.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0);
                o.put("uid", ai.uid);
                arr.put(o);
            } catch (Throwable ignored) {}
        }
        return arr.toString();
    }

    @Override
    public String appLaunch(String pkg) throws Exception {
        if (pkg == null || pkg.isEmpty()) throw new RuntimeException("pkg_required");
        android.content.Intent i = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) throw new RuntimeException("not_launchable: " + pkg);
        i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        return "launched";
    }

    @Override
    public String netPing(String host, int count) throws Exception {
        if (count <= 0) count = 4;
        if (count > 10) count = 10;
        JSONArray results = new JSONArray();
        int ok = 0;
        long totalMs = 0;
        for (int i = 0; i < count; i++) {
            long t0 = System.nanoTime();
            boolean success = false;
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(host, 443), 3000);
                success = true;
            } catch (Throwable ignored) {}
            long ms = (System.nanoTime() - t0) / 1_000_000L;
            if (success) { ok++; totalMs += ms; }
            results.put(new JSONObject().put("seq", i+1).put("ok", success).put("ms", ms));
            Thread.sleep(200);
        }
        return new JSONObject()
            .put("host", host).put("count", count).put("ok", ok)
            .put("avgMs", ok > 0 ? totalMs / ok : 0)
            .put("results", results).toString();
    }

    @Override
    public String netDns(String host) throws Exception {
        InetAddress[] addrs = InetAddress.getAllByName(host);
        JSONArray arr = new JSONArray();
        for (InetAddress a : addrs) arr.put(a.getHostAddress());
        return new JSONObject().put("host", host).put("addresses", arr).toString();
    }

    @Override
    public String netFetch(String urlStr) throws Exception {
        if (urlStr == null || urlStr.isEmpty()) throw new RuntimeException("url_required");
        URL u = new URL(urlStr);
        String scheme = u.getProtocol() == null ? "" : u.getProtocol().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new SecurityException("net_fetch_scheme_blocked: " + scheme);
        }
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase();
        if (host.isEmpty()) throw new SecurityException("net_fetch_no_host");
        if (isPrivateHost(host)) {
            throw new SecurityException("net_fetch_private_blocked: " + host);
        }
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        c.setConnectTimeout(5000);
        c.setReadTimeout(10000);
        c.setRequestMethod("GET");
        int code = c.getResponseCode();
        StringBuilder body = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(
                code < 400 ? c.getInputStream() : c.getErrorStream()))) {
            String line;
            while ((line = r.readLine()) != null) {
                body.append(line).append('\n');
                if (body.length() > 100_000) break;
            }
        }
        return new JSONObject()
            .put("status", code)
            .put("bytes", body.length())
            .put("body", body.toString()).toString();
    }

    private static boolean isPrivateHost(String host) {
        if (host.equals("localhost") || host.equals("localhost.localdomain")) return true;
        if (host.equals("0.0.0.0") || host.equals("127.0.0.1") || host.equals("::1")) return true;
        if (host.startsWith("127.")) return true;
        if (host.startsWith("10.")) return true;
        if (host.startsWith("192.168.")) return true;
        if (host.startsWith("169.254.")) return true;
        if (host.matches("^172\\.(1[6-9]|2[0-9]|3[01])\\..*")) return true;
        if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
        return false;
    }

    private int mapStream(int s) {
        switch (s) {
            case 1: return AudioManager.STREAM_RING;
            case 2: return AudioManager.STREAM_MUSIC;
            case 3: return AudioManager.STREAM_ALARM;
            case 4: return AudioManager.STREAM_NOTIFICATION;
            case 5: return AudioManager.STREAM_SYSTEM;
            case 6: return AudioManager.STREAM_VOICE_CALL;
            default: return s;
        }
    }

    // ── Patch 45: v1.2.0 universal ────────────────────────

    @Override
    public String calendarEvents(int days) throws Exception {
        need(Manifest.permission.READ_CALENDAR);
        if (days <= 0) days = 7;
        if (days > 365) days = 365;
        long now = System.currentTimeMillis();
        long end = now + (long) days * 24L * 3600L * 1000L;

        String[] proj = {
            CalendarContract.Events._ID,
            CalendarContract.Events.TITLE,
            CalendarContract.Events.DTSTART,
            CalendarContract.Events.DTEND,
            CalendarContract.Events.ALL_DAY,
            CalendarContract.Events.EVENT_LOCATION,
            CalendarContract.Events.CALENDAR_ID,
        };
        String sel = CalendarContract.Events.DTSTART + ">=? AND " +
                     CalendarContract.Events.DTSTART + "<=?";
        String[] args = { String.valueOf(now), String.valueOf(end) };

        JSONArray arr = new JSONArray();
        try (android.database.Cursor c = ctx.getContentResolver().query(
                CalendarContract.Events.CONTENT_URI, proj, sel, args,
                CalendarContract.Events.DTSTART + " ASC")) {
            if (c != null) {
                while (c.moveToNext()) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("id", c.getLong(0));
                        o.put("title", c.getString(1));
                        o.put("start_ms", c.getLong(2));
                        o.put("end_ms", c.isNull(3) ? 0 : c.getLong(3));
                        o.put("all_day", c.getInt(4) == 1);
                        o.put("location", c.isNull(5) ? "" : c.getString(5));
                        o.put("calendar_id", c.getLong(6));
                        arr.put(o);
                    } catch (Throwable ignored) {}
                }
            }
        }
        return arr.toString();
    }

    @Override
    public String alarmNext() throws Exception {
        JSONObject o = new JSONObject();
        try {
            android.app.AlarmManager am =
                    (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                android.app.AlarmManager.AlarmClockInfo info = am.getNextAlarmClock();
                if (info != null) {
                    o.put("trigger_ms", info.getTriggerTime());
                    android.app.PendingIntent pi = info.getShowIntent();
                    if (pi != null) o.put("hasShowIntent", true);
                }
            }
        } catch (Throwable ignored) {}

        try {
            String s = android.provider.Settings.System.getString(
                    ctx.getContentResolver(),
                    android.provider.Settings.System.NEXT_ALARM_FORMATTED);
            if (s != null && !s.isEmpty()) o.put("formatted", s);
        } catch (Throwable ignored) {}

        return o.toString();
    }

    private static String sanitizeFilename(String name) {
        if (name == null || name.isEmpty()) return "mtapi.txt";
        String s = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        while (s.contains("..")) s = s.replace("..", "_");
        if (s.startsWith(".")) s = "_" + s;
        if (s.isEmpty()) s = "mtapi.txt";
        return s;
    }

    @Override
    public String filesSave(String name, String data) throws Exception {
        name = sanitizeFilename(name);
        byte[] bytes = data == null ? new byte[0] : data.getBytes("UTF-8");

        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    android.os.Environment.DIRECTORY_DOWNLOADS);
            android.net.Uri uri = ctx.getContentResolver().insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new RuntimeException("insert_failed");
            try (OutputStream os = ctx.getContentResolver().openOutputStream(uri)) {
                if (os == null) throw new RuntimeException("open_failed");
                os.write(bytes);
            }
            return new JSONObject()
                    .put("path", "/sdcard/Download/" + name)
                    .put("bytes", bytes.length)
                    .toString();
        } else {
            java.io.File d = new java.io.File("/sdcard/Download");
            if (!d.exists()) d.mkdirs();
            java.io.File f = new java.io.File(d, name).getCanonicalFile();
            if (!f.getPath().startsWith(d.getCanonicalPath() + "/")) throw new SecurityException("files_save_traversal: " + f.getPath());
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(f)) {
                fos.write(bytes);
            }
            return new JSONObject()
                    .put("path", f.getAbsolutePath())
                    .put("bytes", bytes.length)
                    .toString();
        }
    }

    @Override
    public String audioPlay(String uri) throws Exception {
        if (uri == null || uri.isEmpty()) throw new RuntimeException("uri_required");
        synchronized (this) {
            if (player != null) {
                try { player.release(); } catch (Throwable ignored) {}
                player = null;
            }
            final MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            if (uri.startsWith("http://") || uri.startsWith("https://")) {
                mp.setDataSource(uri);
            } else if (uri.startsWith("/")) {
                mp.setDataSource(uri);
            } else if (uri.startsWith("content://")) {
                mp.setDataSource(ctx, android.net.Uri.parse(uri));
            } else {
                throw new RuntimeException("bad_uri: need http(s)://, content://, or /path");
            }
            mp.setOnCompletionListener(m -> {
                try { m.release(); } catch (Throwable ignored) {}
                synchronized (AndroidApiImpl.this) { if (player == m) player = null; }
            });
            mp.prepare();
            mp.start();
            player = mp;
            return new JSONObject()
                    .put("playing", true)
                    .put("uri", uri)
                    .put("duration_ms", mp.getDuration())
                    .toString();
        }
    }

    @Override
    public String audioPlayStop() throws Exception {
        synchronized (this) {
            if (player != null) {
                try { player.stop(); } catch (Throwable ignored) {}
                try { player.release(); } catch (Throwable ignored) {}
                player = null;
                return "stopped";
            }
            return "not_playing";
        }
    }

    @Override
    public String ttsVoices() throws Exception {
        final java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
        final TextToSpeech[] ref = new TextToSpeech[1];
        final JSONArray out = new JSONArray();

        ref[0] = new TextToSpeech(ctx, status -> {
            if (status == TextToSpeech.SUCCESS) {
                try {
                    Set<Voice> voices = ref[0].getVoices();
                    if (voices != null) {
                        for (Voice v : voices) {
                            JSONObject o = new JSONObject();
                            o.put("name", v.getName());
                            o.put("locale", v.getLocale().toString());
                            o.put("quality", v.getQuality());
                            o.put("latency", v.getLatency());
                            o.put("network", v.isNetworkConnectionRequired());
                            out.put(o);
                        }
                    }
                } catch (Throwable ignored) {}
            }
            latch.countDown();
        });
        if (!latch.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
            throw new RuntimeException("tts_init_timeout");
        }
        try { ref[0].shutdown(); } catch (Throwable ignored) {}
        return out.toString();
    }

    @Override
    public String ttsStop() throws Exception {
        if (cachedTts != null) {
            try { cachedTts.stop(); } catch (Throwable ignored) {}
        }
        return "ok";
    }

    @Override
    public String clipboardWatchStart(int hz) throws Exception {
        if (clipWatchThread != null && clipWatchThread.isAlive()) return "already_watching";
        if (hz <= 0) hz = 2;
        if (hz > 20) hz = 20;
        final int delay = 1000 / hz;
        final String[] last = { null };
        final android.content.ClipboardManager cm =
                (android.content.ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) throw new RuntimeException("no_clipboard");
        if (cm.getPrimaryClip() != null && cm.getPrimaryClip().getItemCount() > 0) {
            CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(ctx);
            if (t != null) last[0] = t.toString();
        }

        clipWatchThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(delay);
                    if (cm.getPrimaryClip() == null || cm.getPrimaryClip().getItemCount() == 0) continue;
                    CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(ctx);
                    if (t == null) continue;
                    String s = t.toString();
                    if (last[0] == null || !last[0].equals(s)) {
                        last[0] = s;
                        // privacy: clipboard content not logged to logcat (security audit B.4)
                    }
                } catch (InterruptedException ie) {
                    return;
                } catch (Throwable ignored) {}
            }
        }, "mtapi-clipwatch");
        clipWatchThread.start();
        return new JSONObject().put("watching", true).put("hz", hz).toString();
    }

    @Override
    public String clipboardWatchStop() throws Exception {
        if (clipWatchThread != null) {
            clipWatchThread.interrupt();
            clipWatchThread = null;
            return "stopped";
        }
        return "not_watching";
    }

    @Override
    public String locationWatchStart(int hz) throws Exception {
        need(Manifest.permission.ACCESS_FINE_LOCATION);
        if (locWatchThread != null && locWatchThread.isAlive()) return "already_watching";
        if (hz <= 0) hz = 1;
        if (hz > 10) hz = 10;
        final long minMs = 1000L / hz;
        final LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) throw new RuntimeException("no_location_manager");

        sLocLm = lm;
        locWatchThread = new Thread(() -> {
            final LocationListener listener = new LocationListener() {
                @Override public void onLocationChanged(Location l) {
                    // privacy: location not logged to logcat (security audit B.4)
                }
                @Override public void onStatusChanged(String p, int s, android.os.Bundle b) {}
                @Override public void onProviderEnabled(String p) {}
                @Override public void onProviderDisabled(String p) {}
            };
            sLocListener = listener;
            try {
                android.os.Looper.prepare();
                sLocLooper = android.os.Looper.myLooper();
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, minMs, 0f, listener);
                }
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, minMs, 0f, listener);
                }
                android.os.Looper.loop();
            } catch (Throwable ignored) {}
        }, "mtapi-locwatch");
        locWatchThread.start();
        return new JSONObject().put("watching", true).put("hz", hz).toString();
    }

    @Override
    public String locationWatchStop() throws Exception {
        LocationListener l = sLocListener;
        LocationManager lm = sLocLm;
        android.os.Looper lo = sLocLooper;
        sLocListener = null;
        sLocLm = null;
        sLocLooper = null;
        if (lm != null && l != null) {
            try { lm.removeUpdates(l); } catch (Throwable ignored) {}
        }
        if (lo != null) {
            try { lo.quitSafely(); } catch (Throwable ignored) {}
        }
        Thread t = locWatchThread;
        locWatchThread = null;
        if (t != null) {
            t.interrupt();
            return "stopped";
        }
        return "not_watching";
    }
        return "not_watching";
    }

    // Patch 46: install APK via system installer
    @Override
    public String installApk(String path) throws Exception {
        if (path == null || path.isEmpty() || !path.startsWith("/")) {
            throw new RuntimeException("install_path_required");
        }
        java.io.File f = new java.io.File(path).getCanonicalFile();
        String cp = f.getPath();
        if (!cp.startsWith("/sdcard/Download/")
            && !cp.startsWith("/storage/emulated/0/Download/")
            && !cp.startsWith("/data/data/dev.mtapi/")
            && !cp.startsWith("/data/user/0/dev.mtapi/")) {
            throw new SecurityException("install_path_not_allowed: " + cp);
        }
        if (!f.exists()) throw new RuntimeException("apk_not_found: " + cp);
        if (!f.getName().endsWith(".apk")) throw new RuntimeException("not_an_apk: " + cp);
        android.net.Uri uri;
        if (Build.VERSION.SDK_INT >= 24) {
            uri = androidx.core.content.FileProvider.getUriForFile(ctx, "dev.mtapi.fileprovider", f);
        } else {
            uri = android.net.Uri.fromFile(f);
        }
        android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        return new JSONObject().put("installer_opened", true).put("path", cp).toString();
    }

}
