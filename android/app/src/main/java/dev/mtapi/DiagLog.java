package dev.mtapi;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class DiagLog {
    private static final String TAG = "mtapi-diag";
    private static final SimpleDateFormat FMT = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US);

    private DiagLog() {}

    // internal files dir: always fast, no FUSE, no scoped storage
    private static File logFile(Context ctx) {
        return new File(ctx.getFilesDir(), "diag.log");
    }

    public static synchronized void write(Context ctx, String msg) {
        // 1) logcat first — never blocks
        Log.i(TAG, msg);
        // 2) file second — best effort, swallow all errors
        try {
            FileOutputStream fos = new FileOutputStream(logFile(ctx), true);
            String line = FMT.format(new Date()) + " " + msg + "\n";
            fos.write(line.getBytes("UTF-8"));
            fos.close();
        } catch (Throwable ignored) {}
    }

    public static synchronized String read(Context ctx) {
        try {
            File f = logFile(ctx);
            if (!f.exists()) return "(empty)";
            FileInputStream fis = new FileInputStream(f);
            byte[] b = new byte[(int) f.length()];
            fis.read(b);
            fis.close();
            return new String(b, "UTF-8");
        } catch (Throwable t) {
            return "read err: " + t;
        }
    }

    public static synchronized void clear(Context ctx) {
        try { logFile(ctx).delete(); } catch (Throwable ignored) {}
    }
}
