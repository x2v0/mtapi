package dev.mtapi;

import android.app.Application;
import android.util.Log;

public class App extends Application {
    private static final String TAG = "mtapi";

    @Override
    public void onCreate() {
        super.onCreate();

        // Java uncaught exceptions → diag file (SIGSEGV won't reach here)
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            DiagLog.write(this, "UNCAUGHT in " + t.getName() + ": " + e);
            Log.e(TAG, "UNCAUGHT", e);
            // give the default handler a chance (kill process cleanly)
            Thread.getDefaultUncaughtExceptionHandler();
        });

        DiagLog.write(this, "App.onCreate");
    }
}
