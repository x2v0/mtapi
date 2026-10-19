package dev.mtapi;

import android.app.Application;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class App extends Application {
    private static final String TAG = "mtapi";

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            android.system.Os.setenv("GOMAXPROCS", "1", true);
            android.system.Os.setenv("GOGC", "100", true);
            android.system.Os.setenv("GOMEMLIMIT", "64MiB", true);
            android.system.Os.setenv("GODEBUG", "asyncpreemptoff=1,madvdontneed=1", true);
            DiagLog.write(this, "App: GOGC=100 GOMEMLIMIT=64MiB GOMAXPROCS=1");
        } catch (Throwable t) {
            DiagLog.write(this, "App: setenv failed " + t);
        }
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            DiagLog.write(this, "UNCAUGHT: " + e);
            Log.e(TAG, "UNCAUGHT", e);
        });
        try {
            Intent svc = new Intent(this, ApiService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
            DiagLog.write(this, "App: startService(ApiService) OK");
        } catch (Throwable t) {
            DiagLog.write(this, "App: startService failed " + t);
            Log.e(TAG, "startService failed", t);
        }
        DiagLog.write(this, "App.onCreate");
    }
}
