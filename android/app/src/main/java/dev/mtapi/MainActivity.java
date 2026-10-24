package dev.mtapi;
import android.content.pm.PackageManager;
import java.util.ArrayList;
import java.util.List;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {

    // MTAPI_247: restart whole app (MainActivity + ApiService + Go subprocess)
    public void restartApp() {
        android.util.Log.i("mtapi", "restartApp() called");
        try {
            // 1. stop ApiService (kills Go subprocess)
            Intent svc = new Intent(this, ApiService.class);
            stopService(svc);
            android.util.Log.i("mtapi", "restartApp: stopService OK");

            // 2. restart via AlarmManager + finishAffinity (без killProcess — MIUI блокирует)
            android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
            android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
                this, 0,
                new Intent(this, MainActivity.class),
                android.app.PendingIntent.FLAG_CANCEL_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            am.set(android.app.AlarmManager.RTC, System.currentTimeMillis() + 500, pi);
            android.util.Log.i("mtapi", "restartApp: AlarmManager set +500ms");

            // 3. finishAffinity + killProcess (fallback)
            finishAffinity();
            android.os.Process.killProcess(android.os.Process.myPid());
        } catch (Throwable t) {
            android.util.Log.e("mtapi", "restartApp failed: " + t);
        }
    }

    private WebView webView;
    private volatile boolean pollActive = true;
    private Thread pollThread;

    private static final String LOADER_HTML =
        "<!doctype html><html><head><meta charset=utf-8>" +
        "<meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<style>body{margin:0;background:#1e1e1e;color:#666;" +
        "font-family:ui-monospace,monospace;display:flex;align-items:center;" +
        "justify-content:center;height:100vh}" +
        ".s{width:16px;height:16px;border:2px solid #333;border-top-color:#4fc3f7;" +
        "border-radius:50%;animation:r .8s linear infinite;margin-right:10px}" +
        "@keyframes r{to{transform:rotate(360deg)}}</style></head>" +
        "<body><div class=s></div><span>starting…</span></body></html>";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        requestAllPermissions();



        webView = new WebView(this);
        // MTAPI_328: WebView debugging (ПОСЛЕ new WebView)
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            try {
                android.webkit.WebView.setWebContentsDebuggingEnabled(true);
                android.util.Log.i("mtapi", "WebView debugging enabled (debug build)");
            } catch (Throwable t) {
                android.util.Log.e("mtapi", "WebView debugging failed: " + t);
            }
        }


        // MTAPI_247: JS interface for full app restart
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void restartApp() {
                MainActivity.this.restartApp();
            }
        
            @android.webkit.JavascriptInterface
            public String saveFile(String name, String data) {
                return MainActivity.this.saveFileToDownloads(name, data);
            }

            @android.webkit.JavascriptInterface
            public String processList() {
                return MainActivity.this.processList();
            }

            @android.webkit.JavascriptInterface
            public String getLogcat(int lines) {
                if (lines <= 0) lines = 100;
                try {
                    java.lang.Process p = Runtime.getRuntime().exec(new String[]{"logcat", "-d", "-t", String.valueOf(lines)});
                    java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line).append('\n');
                    r.close();
                    p.waitFor();
                    return sb.toString();
                } catch (Throwable t) {
                    return "(logcat error: " + t + ")";
                }
            }
}, "Android");
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 21) {
            ws.setMediaPlaybackRequiresUserGesture(false);
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://127.0.0.1:7788") ||
                    url.startsWith("http://localhost") ||
                    url.startsWith("data:")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
                } catch (Throwable ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        FrameLayout root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        webView.loadDataWithBaseURL(null, LOADER_HTML, "text/html", "utf-8", null);

        try {
            Intent svc = new Intent(this, ApiService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Throwable ignored) {}

        startPolling();
    }

    // MTAPI_PERMISSIONS: запросить все runtime permissions при старте
    private void requestAllPermissions() {
        if (Build.VERSION.SDK_INT < 23) return;
        List<String> toRequest = new ArrayList<>();
        String[] all = {
            "android.permission.CAMERA",
            "android.permission.RECORD_AUDIO",
            "android.permission.READ_CONTACTS",
            "android.permission.WRITE_CONTACTS",
            "android.permission.READ_CALL_LOG",
            "android.permission.WRITE_CALL_LOG",
            "android.permission.READ_SMS",
            "android.permission.SEND_SMS",
            "android.permission.RECEIVE_SMS",
            "android.permission.READ_CALENDAR",
            "android.permission.WRITE_CALENDAR",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.READ_PHONE_STATE",
            "android.permission.READ_PHONE_NUMBERS",
            "android.permission.CALL_PHONE",
            "android.permission.BODY_SENSORS",
            "android.permission.READ_EXTERNAL_STORAGE",
        };
        for (String p : all) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                toRequest.add(p);
            }
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            toRequest.add("android.permission.POST_NOTIFICATIONS");
        }
        if (Build.VERSION.SDK_INT >= 31) {
            if (checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED)
                toRequest.add("android.permission.BLUETOOTH_CONNECT");
            if (checkSelfPermission("android.permission.BLUETOOTH_SCAN") != PackageManager.PERMISSION_GRANTED)
                toRequest.add("android.permission.BLUETOOTH_SCAN");
        }
        if (Build.VERSION.SDK_INT < 29 &&
            checkSelfPermission("android.permission.WRITE_EXTERNAL_STORAGE") != PackageManager.PERMISSION_GRANTED) {
            toRequest.add("android.permission.WRITE_EXTERNAL_STORAGE");
        }
        if (!toRequest.isEmpty()) {
            try {
                requestPermissions(toRequest.toArray(new String[0]), 1001);
            } catch (Throwable t) {
                android.util.Log.e("mtapi", "requestPermissions failed: " + t);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // Ничего не делаем — endpoint сам вернёт permission_required при отказе
    }


    private void startPolling() {
        if (pollThread != null) {
            pollActive = false;
            pollThread.interrupt();
        }
        pollActive = true;
        pollThread = new Thread(() -> {
            long deadline = System.currentTimeMillis() + 30000L;
            while (pollActive && System.currentTimeMillis() < deadline) {
                if (Thread.currentThread().isInterrupted()) return;
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection)
                            new java.net.URL("http://127.0.0.1:7788/ping").openConnection();
                    c.setConnectTimeout(500);
                    c.setReadTimeout(500);
                    c.setRequestMethod("GET");
                    int code = c.getResponseCode();
                    if (code == 200 || code == 401) {
                        final String tok = Token.getOrCreate(MainActivity.this);
                        runOnUiThread(() -> {
                            if (!pollActive) return;
                            webView.loadUrl("http://127.0.0.1:7788/?token=" + tok);
                        });
                        return;
                    }
                } catch (Throwable ignored) {}
                try { Thread.sleep(200); } catch (InterruptedException e) { return; }
            }
            if (pollActive) {
                runOnUiThread(() -> {
                    String tok = Token.getOrCreate(MainActivity.this);
                    webView.loadUrl("http://127.0.0.1:7788/?token=" + tok);
                });
            }
        }, "mtapi-poll");
        pollThread.setDaemon(true);
        pollThread.start();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        pollActive = false;
        if (pollThread != null) pollThread.interrupt();
        if (webView != null) {
            try { webView.destroy(); } catch (Throwable ignored) {}
        }
        super.onDestroy();
    }

    // MTAPI_264: сохранить файл в Downloads
    @android.webkit.JavascriptInterface
    public String saveFileToDownloads(String name, String data) {
        try {
            if (name == null || name.isEmpty()) name = "mtapi.txt";
            String safe = name.replaceAll("[^a-zA-Z0-9._-]", "_");
            while (safe.contains("..")) safe = safe.replace("..", "_");
            if (safe.startsWith(".")) safe = "_" + safe;
            if (safe.isEmpty()) safe = "mtapi.txt";
            java.io.File dir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            java.io.File f = new java.io.File(dir, safe).getCanonicalFile();
            if (!f.getPath().startsWith(dir.getCanonicalPath() + "/")) {
                throw new SecurityException("savefile_traversal: " + f.getPath());
            }
            java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
            fos.write(data.getBytes("UTF-8"));
            fos.close();
            android.util.Log.i("mtapi", "saveFileToDownloads: " + f.getAbsolutePath() + " (" + data.length() + "b)");
            return f.getAbsolutePath();
        } catch (Throwable t) {
            android.util.Log.e("mtapi", "saveFileToDownloads failed: " + t);
            return null;
        }
    }


    // MTAPI_311: processList — подробно свой процесс (Android 7+ SELinux)
    @android.webkit.JavascriptInterface
    public String processList() {
        StringBuilder sb = new StringBuilder();
        try {
            android.app.ActivityManager am = (android.app.ActivityManager)
                getSystemService(android.content.Context.ACTIVITY_SERVICE);
            java.util.List<android.app.ActivityManager.RunningAppProcessInfo> procs =
                am.getRunningAppProcesses();
            sb.append("=== mtapi process (").append(procs.size()).append(") ===\n");
            for (android.app.ActivityManager.RunningAppProcessInfo p : procs) {
                sb.append("pid=").append(p.pid)
                  .append(" name=").append(p.processName)
                  .append(" uid=").append(p.uid)
                  .append(" importance=").append(p.importance)
                  .append(" reasonCode=").append(p.importanceReasonCode)
                  .append("\n");
            }

            // /proc/self — детали своего процесса (доступно без root)
            try {
                String cmdline = _readFile("/proc/self/cmdline").replace("\u0000", " ").trim();
                if (cmdline.length() > 0) sb.append("cmdline=").append(cmdline).append("\n");

                String status = _readFile("/proc/self/status");
                if (status.length() > 0) {
                    sb.append("\n=== /proc/self/status ===\n");
                    String[] lines = status.split("\n");
                    for (String line : lines) {
                        if (line.startsWith("Name:") || line.startsWith("State:")
                            || line.startsWith("Pid:") || line.startsWith("PPid:")
                            || line.startsWith("Threads:") || line.startsWith("VmRSS:")
                            || line.startsWith("VmSize:") || line.startsWith("VmData:")
                            || line.startsWith("VmStk:") || line.startsWith("VmExe:")
                            || line.startsWith("VmPeak:") || line.startsWith("VmSwap:")) {
                            sb.append(line).append("\n");
                        }
                    }
                }

                // threads / vsize / rss из /proc/self/stat
                String stat = _readFile("/proc/self/stat");
                if (stat.length() > 0) {
                    String[] parts = stat.split(" ");
                    if (parts.length > 23) {
                        sb.append("\nthreads=").append(parts[19])
                          .append(" starttime=").append(parts[21])
                          .append(" vsize=").append(parts[22])
                          .append(" rss_pages=").append(parts[23]).append("\n");
                    }
                }

                // открытые fd
                try {
                    java.io.File fdDir = new java.io.File("/proc/self/fd");
                    String[] fds = fdDir.list();
                    if (fds != null) sb.append("open_fds=").append(fds.length).append("\n");
                } catch (Throwable ignored) {}
            } catch (Throwable t) {
                sb.append("/proc error: ").append(t).append("\n");
            }

            sb.append("\n# NOTE: Android 7+ (API 24) SELinux blocks /proc of other processes.\n");
            sb.append("# Shown only own process (avc: denied /proc/pid_max for untrusted_app).\n");
            sb.append("# For all processes — system-level API or root required.\n");
        } catch (Throwable t) {
            sb.append("error: ").append(t).append("\n");
        }
        return sb.toString();
    }

    // Helper: read file as string
    private String _readFile(String path) {
        try {
            java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader(path));
            StringBuilder sb = new StringBuilder();
            String line;
            boolean first = true;
            while ((line = r.readLine()) != null) {
                if (!first) sb.append("\n");
                sb.append(line);
                first = false;
            }
            r.close();
            return sb.toString();
        } catch (Throwable t) { return ""; }
    }

}
