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
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final String TAG = "mtapi";
    private static final int REQ = 0x4d50;
    private TextView statusView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

        Button copyBtn = new Button(this);
        copyBtn.setText("Copy token");
        copyBtn.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mtapi", tok));
        });

        Button checkBtn = new Button(this);
        checkBtn.setText("Check native (.so load)");
        checkBtn.setOnClickListener(v -> {
            try {
                boolean ok = Mobile.ensureLoaded();
                if (ok) {
                    statusView.setText("native: loaded\nping: " + Mobile.nativePing());
                } else {
                    statusView.setText("native: NOT loaded\nerror: " + Mobile.getLoadError());
                }
            } catch (Throwable t) {
                // SIGSEGV won't be caught, but Java exceptions will
                statusView.setText("check threw: " + t);
                Log.e(TAG, "check threw", t);
            }
        });

        Button startBtn = new Button(this);
        startBtn.setText("Start daemon");
        startBtn.setOnClickListener(v -> {
            try {
                Intent i = new Intent(this, ApiService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(i);
                } else {
                    startService(i);
                }
                statusView.setText("daemon start requested — check notification");
            } catch (Throwable t) {
                statusView.setText("daemon start failed: " + t);
                Log.e(TAG, "daemon start failed", t);
            }
        });

        Button permBtn = new Button(this);
        permBtn.setText("Grant permissions");
        permBtn.setOnClickListener(v -> requestPermsIfNeeded());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(48, 96, 48, 48);
        root.addView(tv);
        root.addView(statusView);
        root.addView(copyBtn);
        root.addView(checkBtn);
        root.addView(startBtn);
        root.addView(permBtn);
        setContentView(root);

        Log.i(TAG, "MainActivity.onCreate done");
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
