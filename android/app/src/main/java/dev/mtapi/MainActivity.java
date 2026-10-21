package dev.mtapi;

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

        webView = new WebView(this);

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
}, "Android");
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
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
            java.io.File dir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            java.io.File f = new java.io.File(dir, name);
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

}
