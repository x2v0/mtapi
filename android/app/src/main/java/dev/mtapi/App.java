package dev.mtapi;

import android.app.Application;
import android.util.Log;

/**
 * Deliberately does NOT auto-start ApiService.
 * If .so load or service init crashes, we want the UI to have shown
 * first so the user can see status before any daemon crashes.
 */
public class App extends Application {
    private static final String TAG = "mtapi";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Application.onCreate");
    }
}
