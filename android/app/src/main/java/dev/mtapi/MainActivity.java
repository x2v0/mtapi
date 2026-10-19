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

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final String TAG = "mtapi";
    private static final int REQ = 0x4d50;
    private TextView statusView;
    private TextView logView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        DiagLog.write(this, "MainActivity.onCreate start");
        Log.i(TAG, "MainActivity.onCreate start");

        final String tok = Token.getOrCreate(this);

        TextView tv = new TextView(this);
        tv.setText("token:\n" + tok);
        tv.setTextIsSelectable(true);
        tv.setTextSize(14f);

        statusView = new TextView(this);
        statusView.setTextSize(12f);
        statusView.setPadding(0, 24, 0, 24);
        statusView.setText("(not checked yet)");

        logView = new TextView(this);
        logView.setTextSize(10f);
        logView.setTextIsSelectable(true);
        logView.setPadding(0, 8, 0, 8);
        logView.setText("(log empty)");

        Button copyBtn = new Button(this);
        copyBtn.setText("Copy token");
        copyBtn.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mtapi", tok));
        });

        Button smokeBtn = new Button(this);
        smokeBtn.setText("1. Smoke (native int)");
        smokeBtn.setOnClickListener(v -> {
            DiagLog.write(this, "click: smoke");
            statusView.setText("smoke: calling...");
            try {
                boolean ok = Mobile.ensureLoaded();
                DiagLog.write(this, "smoke: ensureLoaded=" + ok);
                if (!ok) {
                    statusView.setText("smoke: loadLibrary failed: " + Mobile.getLoadError());
                    return;
                }
                DiagLog.write(this, "smoke: about to call nativeSmoke");
                int r = Mobile.nativeSmoke();
                DiagLog.write(this, "smoke: nativeSmoke returned " + r);
                statusView.setText("smoke: " + r + " (loaded, no JVM, no socket)");
            } catch (Throwable t) {
                DiagLog.write(this, "smoke: threw " + t);
                statusView.setText("smoke threw: " + t);
            }
        });

        Button verBtn = new Button(this);
        verBtn.setText("2. Version (native String)");
        verBtn.setOnClickListener(v -> {
            DiagLog.write(this, "click: version");
            try {
                Mobile.ensureLoaded();
                DiagLog.write(this, "version: about to call nativeVersion");
                String v = Mobile.nativeVersion();
                DiagLog.write(this, "version: returned " + v);
                statusView.setText("version: " + v);
            } catch (Throwable t) {
                DiagLog.write(this, "version: threw " + t);
                statusView.setText("version threw: " + t);
            }
        });

        Button pingBtn = new Button(this);
        pingBtn.setText("3. Ping (existing native)");
        pingBtn.setOnClickListener(v -> {
            DiagLog.write(this, "click: ping");
            try {
                Mobile.ensureLoaded();
                DiagLog.write(this, "ping: about to call nativePing");
                String v = Mobile.nativePing();
                DiagLog.write(this, "ping: returned " + v);
                statusView.setText("ping: " + v);
            } catch (Throwable t) {
                DiagLog.write(this, "ping: threw " + t);
                statusView.setText("ping threw: " + t);
            }
        });

        Button startBtn = new Button(this);
        startBtn.setText("4. Start daemon");
        startBtn.setOnClickListener(v -> {
            DiagLog.write(this, "click: start_daemon");
            try {
                Intent i = new Intent(this, ApiService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(i);
                } else {
                    startService(i);
                }
                DiagLog.write(this, "start_daemon: intent sent");
                statusView.setText("daemon start requested — check notification");
            } catch (Throwable t) {
                DiagLog.write(this, "start_daemon: threw " + t);
                statusView.setText("daemon start failed: " + t);
            }
        });

        Button permBtn = new Button(this);
        permBtn.setText("5. Grant permissions");
        permBtn.setOnClickListener(v -> requestPermsIfNeeded());

        Button showLogBtn = new Button(this);
        showLogBtn.setText("Show log");
        showLogBtn.setOnClickListener(v -> {
            logView.setText(DiagLog.read(this));
        });

        Button clearLogBtn = new Button(this);
        clearLogBtn.setText("Clear log");
        clearLogBtn.setOnClickListener(v -> {
            DiagLog.clear(this);
            logView.setText("(cleared)");
        });

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(48, 96, 48, 48);
        root.addView(tv);
        root.addView(statusView);
        root.addView(copyBtn);
        root.addView(smokeBtn);
        root.addView(verBtn);
        root.addView(pingBtn);
        root.addView(startBtn);
        root.addView(permBtn);
        root.addView(showLogBtn);
        root.addView(clearLogBtn);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(logView);
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 500));
        setContentView(root);

        DiagLog.write(this, "MainActivity.onCreate done");
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
