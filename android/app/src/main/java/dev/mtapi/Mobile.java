package dev.mtapi;

/**
 * JNI wrapper around libgojni.so (built from gocore/jni).
 *
 * Replaces com.google.gomobile.Mobile from gomobile bind.
 * Native methods are implemented in gocore/jni/main.go via //export.
 */
public final class Mobile {

    static {
        System.loadLibrary("gojni");
    }

    private Mobile() {}

    /** Returns 0 on success, -1 on error (start failed). */
    public static native int nativeStart(String token, AndroidAPI api);

    /** Stops the Go server. Idempotent. */
    public static native void nativeStop();

    /** Returns "mtapi/<version>" — used as a liveness check. */
    public static native String nativePing();
}
