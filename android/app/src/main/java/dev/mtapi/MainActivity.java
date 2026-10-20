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
}
