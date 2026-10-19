package dev.mtapi;

import android.app.*;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

public class ApiService extends Service {

    public static final int NOTIF_ID = 0x4d5441;
    private static final String TAG = "mtapi";

    private AndroidApiImpl api;
    private String token;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            startForeground(NOTIF_ID, buildNotification("starting"));
            Log.i(TAG, "startForeground ok");
        } catch (Throwable t) {
            Log.e(TAG, "startForeground failed", t);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // FGS-FIX-53f: Android 12+ requires startForeground() within 5s of
        // startForegroundService(), even if onCreate already ran. Without this
        // on a fresh startForegroundService call the system throws ANR
        // "did not then call Service.startForeground()".
        try {
            Notification n = buildNotification("starting");
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, n, 0x1 /* FOREGROUND_SERVICE_TYPE_DATA_SYNC */);
            } else {
                startForeground(NOTIF_ID, n);
            }
            Log.i(TAG, "onStartCommand: startForeground ok");
        } catch (Throwable t) {
            Log.e(TAG, "onStartCommand: startForeground failed", t);
        }

        if (api != null) return START_STICKY;

        token = Token.getOrCreate(this);
        api = new AndroidApiImpl(this);

        try {
            GoServerLauncher.start(this, api, token);
            updateNotification("running — http://127.0.0.1:7788/");
            DiagLog.write(this, "svc: Go server started");
        } catch (Throwable t) {
            DiagLog.write(this, "svc: Go server start failed " + t);
            updateNotification("error: " + t.getMessage());
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        DiagLog.write(this, "svc: destroy");
        try { GoServerLauncher.stop(this); } catch (Throwable ignored) {}
        api = null;
        super.onDestroy();
    }

    private void updateNotification(String status) {
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification(status));
        } catch (Throwable ignored) {}
    }

    private Notification buildNotification(String text) {
        String ch = "mtapi";
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(new NotificationChannel(
                        ch, "mtapi daemon", NotificationManager.IMPORTANCE_LOW));
            }
        }
        Intent intent;
        if (token != null && !token.isEmpty()) {
            intent = new Intent(Intent.ACTION_VIEW,
                    android.net.Uri.parse("http://127.0.0.1:7788/?token=" + token));
        } else {
            intent = new Intent(this, MainActivity.class);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int piFlags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, piFlags);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, ch);
        } else {
            b = new Notification.Builder(this);
        }
        return b.setContentTitle("mtapi")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }
}
