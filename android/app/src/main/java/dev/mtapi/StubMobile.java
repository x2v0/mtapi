package dev.mtapi;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.util.Log;

import java.io.File;

public final class StubMobile {
    private static final String TAG = "mtapi";
    private static boolean loaded = false;
    private static boolean tried = false;
    private static String err = "";
    private static String diagPath = "";

    private StubMobile() {}

    public static synchronized boolean ensureLoaded(Context ctx) {
        if (tried) return loaded;
        tried = true;

        // where does Android expect .so files?
        ApplicationInfo ai = ctx.getApplicationInfo();
        String libDir = ai.nativeLibraryDir;
        diagPath = libDir;
        File so = new File(libDir, "libstub_gojni.so");

        DiagLog.write(ctx, "stub: libDir=" + libDir);
        DiagLog.write(ctx, "stub: exists=" + so.exists() + " size=" + so.length());

        if (!so.exists()) {
            err = "so not found in " + libDir;
            DiagLog.write(ctx, "stub: " + err);
            return false;
        }

        DiagLog.write(ctx, "stub: System.load(" + so.getAbsolutePath() + ") start");
        try {
            System.load(so.getAbsolutePath());
            loaded = true;
            DiagLog.write(ctx, "stub: System.load ok");
            return true;
        } catch (Throwable t) {
            loaded = false;
            err = String.valueOf(t);
            DiagLog.write(ctx, "stub: System.load THREW " + err);
            return false;
        }
    }

    public static String getError() { return err; }
    public static String getDiagPath() { return diagPath; }
    public static boolean isAvailable() { return loaded; }

    public static native int nativeSmoke();
    public static native String nativePing();
    public static native int nativeStart(String token, AndroidAPI api);
    public static native void nativeStop();
}
