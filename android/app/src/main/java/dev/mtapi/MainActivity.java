package dev.mtapi;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final String TAG = "mtapi";
    private static final int REQ = 0x4d50;
    private static final String BASE = "http://127.0.0.1:7788";
    private TextView statusView;
    private TextView logView;
    private String token;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        DiagLog.write(this, "MainActivity.onCreate start");

        token = Token.getOrCreate(this);
        writeTokenToExternal();
        requestPermsIfNeeded();

        TextView urlView = new TextView(this);
        urlView.setText(BASE + "/?token=" + token.substring(0, 8) + "...");
        urlView.setTextIsSelectable(true);
        urlView.setTextSize(12f);

        TextView tokView = new TextView(this);
        tokView.setText("token:\n" + token);
        tokView.setTextIsSelectable(true);
        tokView.setTextSize(12f);

        statusView = new TextView(this);
        statusView.setTextSize(12f);
        statusView.setPadding(0, 24, 0, 24);
        statusView.setText("(not checked yet)");

        logView = new TextView(this);
        logView.setTextSize(10f);
        logView.setTextIsSelectable(true);
        logView.setPadding(0, 8, 0, 8);
        logView.setText("(log empty)");

        Button startBtn = new Button(this);
        startBtn.setText("1. Start server");
        startBtn.setOnClickListener(v -> {
            DiagLog.write(this, "click: start_server");
            try {
                Intent i = new Intent(this, ApiService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(i);
                } else {
                    startService(i);
                }
                statusView.setText("started — check notification");
            } catch (Throwable t) {
                statusView.setText("start failed: " + t);
            }
        });

        Button pingBtn = new Button(this);
        pingBtn.setText("2. HTTP ping");
        pingBtn.setOnClickListener(v -> httpGetAsync("/ping", "ping"));

        Button battBtn = new Button(this);
        battBtn.setText("3. HTTP battery");
        battBtn.setOnClickListener(v -> httpGetAsync("/battery", "battery"));

        Button devBtn = new Button(this);
        devBtn.setText("4. HTTP device");
        devBtn.setOnClickListener(v -> httpGetAsync("/device", "device"));

        Button toastBtn = new Button(this);
        toastBtn.setText("5. HTTP toast");
        toastBtn.setOnClickListener(v -> httpGetAsync("/toast?text=hello+from+http", "toast"));

        Button openBtn = new Button(this);
        openBtn.setText("6. Open in browser");
        openBtn.setOnClickListener(v -> {
            try {
                String url = BASE + "/?token=" + token;
                DiagLog.write(this, "click: open_browser " + url);
                startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
            } catch (Throwable t) {
                statusView.setText("open browser failed: " + t);
            }
        });

        Button copyBtn = new Button(this);
        copyBtn.setText("Copy token");
        copyBtn.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mtapi", token));
        });

        Button permBtn = new Button(this);
        permBtn.setText("Grant permissions");
        permBtn.setOnClickListener(v -> requestPermsIfNeeded());

        Button showLogBtn = new Button(this);
        showLogBtn.setText("Show log");
        showLogBtn.setOnClickListener(v -> logView.setText(DiagLog.read(this)));

        Button clearLogBtn = new Button(this);
        clearLogBtn.setText("Clear log");
        clearLogBtn.setOnClickListener(v -> { DiagLog.clear(this); logView.setText("(cleared)"); });

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(48, 96, 48, 48);
        root.addView(urlView);
        root.addView(tokView);
        root.addView(statusView);
        root.addView(startBtn);
        root.addView(pingBtn);
        root.addView(battBtn);
        root.addView(devBtn);
        root.addView(toastBtn);
        Button sysBtn = new Button(this);
        sysBtn.setText("Sys info");
        sysBtn.setOnClickListener(v -> httpGetAsync("/system", "system"));
        root.addView(sysBtn);

        Button sensorBtn = new Button(this);
        sensorBtn.setText("Sensors");
        sensorBtn.setOnClickListener(v -> httpGetAsync("/sensors", "sensors"));
        root.addView(sensorBtn);

        Button netBtn = new Button(this);
        netBtn.setText("Network");
        netBtn.setOnClickListener(v -> httpGetAsync("/network", "network"));
        root.addView(netBtn);

        Button battPlusBtn = new Button(this);
        battPlusBtn.setText("Battery+");
        battPlusBtn.setOnClickListener(v -> httpGetAsync("/battery/detailed", "battery_det"));
        root.addView(battPlusBtn);

        Button locDetBtn = new Button(this);
        locDetBtn.setText("Location+");
        locDetBtn.setOnClickListener(v -> httpGetAsync("/location/detailed", "location_det"));
        root.addView(locDetBtn);

        root.addView(openBtn);
        root.addView(copyBtn);
        root.addView(permBtn);
        root.addView(showLogBtn);
        root.addView(clearLogBtn);
        root.addView(logView);

        // Outer vertical ScrollView — вся страница скроллится
        ScrollView outer = new ScrollView(this);
        outer.setFillViewport(true);
        outer.addView(root, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT));
        setContentView(outer);

        // auto-start server
        try {
            Intent i = new Intent(this, ApiService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i);
            else startService(i);
        } catch (Throwable ignored) {}

        DiagLog.write(this, "MainActivity.onCreate done");
    }

    private void httpGetAsync(String path, String label) {
        statusView.setText(label + ": ...");
        new Thread(() -> {
            String result;
            try {
                URL url = new URL(BASE + path + (path.contains("?") ? "&" : "?") + "token=" + token);
                HttpURLConnection c = (HttpURLConnection) url.openConnection();
                c.setConnectTimeout(3000);
                c.setReadTimeout(5000);
                int code = c.getResponseCode();
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(
                        code < 400 ? c.getInputStream() : c.getErrorStream()))) {
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line).append('\n');
                }
                result = "HTTP " + code + "\n" + sb.toString();
            } catch (Throwable t) {
                result = "EXC " + t;
            }
            final String r = result;
            DiagLog.write(this, label + " => " + (r.length() > 300 ? r.substring(0, 300) : r));
            runOnUiThread(() -> statusView.setText(label + ":\n" + r));
        }, "http-" + label).start();
    }

    private void writeTokenToExternal() {
        // Primary: getExternalFilesDir -> /sdcard/Android/data/dev.mtapi/files/token.txt
        //          Always writable by app. Readable via `rish -c 'cat ...'`.
        try {
            java.io.File d = getExternalFilesDir(null);
            if (d != null) {
                if (!d.exists()) d.mkdirs();
                java.io.File f = new java.io.File(d, "token.txt");
                if (f.exists()) f.delete();
                java.io.FileOutputStream fos = new java.io.FileOutputStream(f, false);
                fos.write(token.getBytes("UTF-8"));
                fos.close();
                DiagLog.write(this, "token written to " + f.getAbsolutePath());
            }
        } catch (Throwable t) {
            DiagLog.write(this, "token write (appExternal) failed: " + t);
        }

        // Secondary: /sdcard/Download/mtapi.token (may be blocked by scoped storage)
        try {
            java.io.File f = new java.io.File("/sdcard/Download/mtapi.token");
            if (f.exists()) {
                if (!f.delete()) {
                    f = new java.io.File(f.getParentFile(),
                            "mtapi.token." + System.currentTimeMillis());
                }
            }
            java.io.FileOutputStream fos = new java.io.FileOutputStream(f, false);
            fos.write(token.getBytes("UTF-8"));
            fos.close();
            DiagLog.write(this, "token also written to " + f.getAbsolutePath());
        } catch (Throwable t) {
            DiagLog.write(this, "token write (/sdcard/Download) failed: " + t);
        }

    }

    private void requestPermsIfNeeded() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.POST_NOTIFICATIONS);
        perms.add(Manifest.permission.READ_CONTACTS);
        perms.add(Manifest.permission.READ_CALL_LOG);
        perms.add(Manifest.permission.READ_SMS);
        perms.add(Manifest.permission.SEND_SMS);
        perms.add(Manifest.permission.ACCESS_FINE_LOCATION);
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.READ_PHONE_STATE);
        perms.add(Manifest.permission.RECORD_AUDIO);
        List<String> missing = new ArrayList<>();
        for (String p : perms) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                missing.add(p);
            }
        }
        if (!missing.isEmpty()) {
            requestPermissions(missing.toArray(new String[0]), REQ);
        }
    }
}
