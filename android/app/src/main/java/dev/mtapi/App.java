package dev.mtapi;

import android.app.Application;
import android.util.Log;

public class App extends Application {
    private static final String TAG = "mtapi";

    @Override
    public void onCreate() {
        super.onCreate();

        // Minimal Go runtime threads/memory:
        //   GOMAXPROCS=1        - 1 OS thread for goroutines
        //   GOGC=off            - disable GC (no GC thread)
        //   GOMEMLIMIT=8MiB     - hard memory limit
        //   GODEBUG=...         - disable preemption, don't log inittrace (extra thread)
        try {
            android.system.Os.setenv("GOMAXPROCS", "1", true);
            android.system.Os.setenv("GOGC", "off", true);
            android.system.Os.setenv("GOMEMLIMIT", "8MiB", true);
            android.system.Os.setenv("GODEBUG",
                "asyncpreemptoff=1,madvdontneed=1", true);
            DiagLog.write(this, "App: GOGC=off GOMEMLIMIT=8MiB GOMAXPROCS=1");
        } catch (Throwable t) {
            DiagLog.write(this, "App: setenv failed " + t);
        }

        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            DiagLog.write(this, "UNCAUGHT: " + e);
            Log.e(TAG, "UNCAUGHT", e);
        });

        DiagLog.write(this, "App.onCreate");
    }
}
