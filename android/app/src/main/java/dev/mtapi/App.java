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
            Intent i = new Intent(this, ApiService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(i);
            } else {
                startService(i);
            }
            Log.i(TAG, "FGS start requested from Application");
        } catch (Throwable t) {
            Log.e(TAG, "FGS start failed: " + t, t);
            // try fallback plain startService
            try {
                startService(new Intent(this, ApiService.class));
                Log.i(TAG, "fallback startService ok");
            } catch (Throwable t2) {
                Log.e(TAG, "fallback startService failed: " + t2, t2);
            }
        }
    }
}
