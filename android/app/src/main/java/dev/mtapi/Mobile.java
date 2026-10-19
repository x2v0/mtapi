package dev.mtapi;

import android.util.Log;

public final class Mobile {

    private static final String TAG = "mtapi";
    private static volatile boolean loaded = false;
    private static volatile boolean loadTried = false;
    private static String loadError = "";

    private Mobile() {}

    public static synchronized boolean ensureLoaded() {
        if (loadTried) return loaded;
        loadTried = true;
        try {
            System.loadLibrary("gojni");
            loaded = true;
            Log.i(TAG, "libgojni loaded ok");
        } catch (Throwable t) {
            loaded = false;
            loadError = String.valueOf(t);
            Log.e(TAG, "loadLibrary(gojni) failed: " + loadError, t);
        }
        return loaded;
    }

    public static boolean isAvailable() { return loaded; }
    public static String getLoadError() { return loadError; }

    // JNI entry points
    public static native int    nativeSmoke();      // pure: return 42, no JVM
    public static native String nativeVersion();    // pure: return "mtapi/1", exercises NewStringUTF
    public static native int    nativeStart(String token, AndroidAPI api);
    public static native void   nativeStop();
    public static native String nativePing();
}
