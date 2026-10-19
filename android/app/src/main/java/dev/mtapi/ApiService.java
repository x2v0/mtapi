package dev.mtapi;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

public class ApiService extends Service {

    public static final int NOTIF_ID = 0x4d5441;
    private static final String TAG = "mtapi";

    private boolean started = false;
    private AndroidApiImpl api;
    private String status = "starting";

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            startForeground(NOTIF_ID, buildNotification());
            Log.i(TAG, "startForeground ok");
        } catch (Throwable t) {
            Log.e(TAG, "startForeground failed", t);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (started) return START_STICKY;

        String token = Token.getOrCreate(this);

        if (!Mobile.ensureLoaded()) {
            status = "native_unavailable: " + Mobile.getLoadError();
            Log.e(TAG, status);
            notifyStatus();
            return START_STICKY;
        }

        try {
            api = new AndroidApiImpl(this);
        } catch (Throwable t) {
            Log.e(TAG, "AndroidApiImpl init failed", t);
            status = "api_init_failed";
            notifyStatus();
            return START_STICKY;
        }

        try {
            int rc = Mobile.nativeStart(token, api);
            if (rc == 0) {
                started = true;
                status = "running: " + Mobile.nativePing();
                Log.i(TAG, status);
            } else {
                status = "nativeStart rc=" + rc;
                Log.e(TAG, status);
            }
        } catch (Throwable t) {
            status = "nativeStart_threw: " + t;
            Log.e(TAG, status, t);
        }
        notifyStatus();
        return START_STICKY;
    }

    private void notifyStatus() {
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification());
        } catch (Throwable ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        try {
            Intent restart = new Intent(getApplicationContext(), ApiService.class);
            int piFlags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT;
            PendingIntent pi = PendingIntent.getService(this, 1, restart, piFlags);
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) am.set(AlarmManager.RTC, System.currentTimeMillis() + 1500L, pi);
        } catch (Throwable ignored) {}
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        try { if (started) Mobile.nativeStop(); }
        catch (Throwable t) { Log.e(TAG, "nativeStop", t); }
        started = false;
        super.onDestroy();
    }

    private Notification buildNotification() {
        String ch = "mtapi";
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(
                    new NotificationChannel(ch, "mtapi daemon", NotificationManager.IMPORTANCE_LOW));
            }
        }
        Intent intent = new Intent(this, MainActivity.class);
        int piFlags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, piFlags);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, ch);
        } else {
            b = new Notification.Builder(this);
        }
        return b.setContentTitle("mtapi")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }
}
