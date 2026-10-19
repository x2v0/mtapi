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

public class ApiService extends Service {

    public static final int NOTIF_ID = 0x4d5441;
    private boolean started = false;
    private AndroidApiImpl api;

    @Override
    public void onCreate() {
        super.onCreate();
        startForeground(NOTIF_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!started) {
            String token = Token.getOrCreate(this);
            try {
                api = new AndroidApiImpl(this);
                int rc = Mobile.nativeStart(token, api);
                if (rc == 0) {
                    started = true;
                    android.util.Log.i("mtapi",
                        "started ok; ping=" + Mobile.nativePing());
                } else {
                    android.util.Log.e("mtapi",
                        "nativeStart failed rc=" + rc);
                }
            } catch (Throwable t) {
                android.util.Log.e("mtapi", "start failed", t);
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Intent restart = new Intent(getApplicationContext(), ApiService.class);
        int piFlags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT;
        PendingIntent pi = PendingIntent.getService(this, 1, restart, piFlags);
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am != null) {
            am.set(AlarmManager.RTC, System.currentTimeMillis() + 1500L, pi);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        try {
            if (started) Mobile.nativeStop();
        } catch (Throwable t) {
            android.util.Log.e("mtapi", "stop failed", t);
        }
        started = false;
        super.onDestroy();
    }

    private Notification buildNotification() {
        String ch = "mtapi";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(
                    new NotificationChannel(ch, "mtapi daemon",
                        NotificationManager.IMPORTANCE_LOW));
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
                .setContentText("daemon listening on @mtapi")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }
}
