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

    private static File logFile(Context ctx) {
        File dir = ctx.getExternalFilesDir(null);
        if (dir == null) dir = ctx.getFilesDir();
        return new File(dir, "diag.log");
    }

    public static synchronized void write(Context ctx, String msg) {
        String line = FMT.format(new Date()) + " " + msg + "\n";
        Log.d(TAG, msg);
        try {
            FileOutputStream fos = new FileOutputStream(logFile(ctx), true);
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
