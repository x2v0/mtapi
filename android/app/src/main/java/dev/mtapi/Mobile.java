package dev.mtapi;

import android.util.Log;

/**
 * JNI wrapper around libgojni.so.
 *
 * Hardened: if loadLibrary fails, static block doesn't throw —
 * `available=false`, nativeStart/Stop/Ping short-circuit, app keeps working.
 */
public final class Mobile {

    private static final String TAG = "mtapi";
    private static boolean available = false;
    private static String loadError = "";

    static {
        try {
            System.loadLibrary("gojni");
            available = true;
            Log.i(TAG, "libgojni loaded ok");
        } catch (Throwable t) {
            available = false;
            loadError = String.valueOf(t);
            Log.e(TAG, "loadLibrary(gojni) failed: " + loadError, t);
        }
    }

    private Mobile() {}

    public static boolean isAvailable() { return available; }
    public static String getLoadError() { return loadError; }

    /** Returns 0 on success, -1 on error. Safe if native not loaded. */
    public static int nativeStart(String token, AndroidAPI api) {
        if (!available) {
            Log.w(TAG, "nativeStart: library not loaded: " + loadError);
            return -1;
        }
        try {
            return nativeStartImpl(token, api);
        } catch (Throwable t) {
            Log.e(TAG, "nativeStart threw", t);
            return -1;
        }
    }

    public static void nativeStop() {
        if (!available) return;
        try { nativeStopImpl(); } catch (Throwable t) { Log.e(TAG, "nativeStop", t); }
    }

    public static String nativePing() {
        if (!available) return "unavailable: " + loadError;
        try { return nativePingImpl(); } catch (Throwable t) {
            Log.e(TAG, "nativePing", t);
            return "error: " + t;
        }
    }

    // actual JNI entry points
    private static native int  nativeStartImpl(String token, AndroidAPI api);
    private static native void nativeStopImpl();
    private static native String nativePingImpl();
}
