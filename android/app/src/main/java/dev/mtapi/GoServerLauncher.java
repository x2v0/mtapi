package dev.mtapi;

import android.content.Context;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;

public final class GoServerLauncher {
    private static volatile Process process = null;
    private static volatile JavaBridge bridge = null;

    private GoServerLauncher() {}

    public static synchronized void start(Context ctx, AndroidApiImpl api, String token) {
        if (process != null && process.isAlive()) {
            DiagLog.write(ctx, "launcher: already running");
            return;
        }

        String libDir = ctx.getApplicationInfo().nativeLibraryDir;
        File bin = new File(libDir, "libmtapi-server.so");
        DiagLog.write(ctx, "launcher: bin=" + bin + " exists=" + bin.exists()
                + " canExec=" + bin.canExecute());

        if (!bin.exists()) {
            DiagLog.write(ctx, "launcher: FATAL: binary not found");
            return;
        }

        // Ensure executable
        if (!bin.canExecute()) {
            boolean ok = bin.setExecutable(true, false);
            DiagLog.write(ctx, "launcher: chmod +x -> " + ok);
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(bin.getAbsolutePath());
            pb.environment().put("MTAPI_TOKEN", token);
            pb.environment().put("PATH", "/system/bin:/system/xbin");
            File pidFile = new File(ctx.getFilesDir(), "server.pid");
            pb.environment().put("MTAPI_PIDFILE", pidFile.getAbsolutePath());

            DiagLog.write(ctx, "launcher: spawning...");
            Process p = pb.start();
            process = p;
            DiagLog.write(ctx, "launcher: pid=" + pidOf(p));

            JavaBridge br = new JavaBridge(ctx, api, p);
            bridge = br;
            br.start();

            // Monitor: detect exit
            new Thread(() -> {
                try {
                    int rc = p.waitFor();
                    DiagLog.write(ctx, "launcher: process exited rc=" + rc);
                    process = null;
                    bridge = null;
                } catch (Throwable t) {
                    DiagLog.write(ctx, "launcher: waitFor threw " + t);
                }
            }, "go-monitor").start();

        } catch (Throwable t) {
            DiagLog.write(ctx, "launcher: spawn THREW " + t);
        }
    }

    public static synchronized void stop(Context ctx) {
        Process p = process;
        process = null;
        bridge = null;
        if (p != null) {
            DiagLog.write(ctx, "launcher: destroy");
            try { p.destroy(); } catch (Throwable ignored) {}
        }
    }

    private static String pidOf(Process p) {
        try {
            // On Android 9+ Process.pid() exists
            try {
                java.lang.reflect.Method m = Process.class.getMethod("pid");
                Object v = m.invoke(p);
                if (v != null) return v.toString();
            } catch (Throwable ignored) {}
            return "(unknown)";
        } catch (Throwable t) {
            return "?";
        }
    }
}
