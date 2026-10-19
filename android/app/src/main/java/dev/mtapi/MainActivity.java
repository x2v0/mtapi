package dev.mtapi;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int REQ = 0x4d50;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestPermsIfNeeded();

        final String tok = Token.getOrCreate(this);
        TextView tv = new TextView(this);
        tv.setText("token:\n" + tok);
        tv.setTextIsSelectable(true);
        tv.setTextSize(14f);

        Button copyBtn = new Button(this);
        copyBtn.setText("Copy token");
        copyBtn.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mtapi", tok));
        });

        Button permBtn = new Button(this);
        permBtn.setText("Re-check permissions");
        permBtn.setOnClickListener(v -> requestPermsIfNeeded());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(48, 96, 48, 48);
        root.addView(tv);
        root.addView(copyBtn);
        root.addView(permBtn);
        setContentView(root);
    }

    private void requestPermsIfNeeded() {
        String[] perms = {
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA,
        };
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
