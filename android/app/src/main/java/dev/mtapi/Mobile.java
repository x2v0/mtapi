package dev.mtapi;

import android.util.Log;

/**
 * JNI wrapper around libgojni.so.
 * Symbol names in .so MUST match native method names here:
 *   Java_dev_mtapi_Mobile_nativeStart  <-> native nativeStart
 *   Java_dev_mtapi_Mobile_nativeStop   <-> native nativeStop
 *   Java_dev_mtapi_Mobile_nativePing   <-> native nativePing
 */
public final class Mobile {

    private static final String TAG = "mtapi";
    private static volatile boolean loaded = false;
    private static volatile boolean loadTried = false;
    private static String loadError = "";

    private Mobile() {}

    /** Lazy, idempotent load. Never throws. */
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

    // JNI entry points (names match libgojni.so exports)
    public static native int  nativeStart(String token, AndroidAPI api);
    public static native void nativeStop();
    public static native String nativePing();
}
