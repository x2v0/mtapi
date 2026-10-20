package dev.mtapi;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.nio.charset.StandardCharsets;

public final class JavaBridge {
    private static final String TAG = "mtapi";

    private final Context ctx;
    private final AndroidApiImpl api;
    private final Process process;
    private final BufferedWriter toGo;
    // MTAPI_THREAD_POOL_71: parallel workers so slow endpoints don't block reader
    private final ExecutorService workers = Executors.newFixedThreadPool(8, r -> {
        Thread t = new Thread(r, "bridge-worker-" + WORKER_SEQ.incrementAndGet());
        t.setDaemon(true);
        return t;
    });
    private static final AtomicInteger WORKER_SEQ = new AtomicInteger();
    private volatile boolean running = true;

    public JavaBridge(Context ctx, AndroidApiImpl api, Process process) throws Exception {
        this.ctx = ctx;
        this.api = api;
        this.process = process;
        this.toGo = new BufferedWriter(
                new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
    }

    public void start() {
        new Thread(this::readerLoop, "bridge-reader").start();
        new Thread(this::stderrLoop, "bridge-stderr").start();
        DiagLog.write(ctx, "bridge: started");
    }

    private void readerLoop() {
        DiagLog.write(ctx, "bridge: readerLoop start (8 workers)");
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while (running && (line = r.readLine()) != null) {
                final String _l = line;
                workers.submit(() -> handleRequest(_l));
            }
        } catch (Throwable t) {
            if (running) DiagLog.write(ctx, "bridge: reader exit " + t);
        }
        DiagLog.write(ctx, "bridge: readerLoop end");
    }

    private void stderrLoop() {
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
            String line;
            while (running && (line = r.readLine()) != null) {
                Log.i(TAG + "-go", line);
                DiagLog.write(ctx, "[go] " + line);
            }
        } catch (Throwable ignored) {}
    }

    private void handleRequest(String line) {
        try {
            doHandleRequest(line);
        } catch (Throwable t) {
            DiagLog.write(ctx, "bridge: handleRequest threw " + t);
        }
    }

    private void doHandleRequest(String line) throws Exception {
        JSONObject req;
        try { req = new JSONObject(line); }
        catch (Throwable t) { DiagLog.write(ctx, "bridge: bad JSON " + line); return; }

        long id = req.optLong("id", 0);
        String method = req.optString("method", "");
        JSONObject params = req.optJSONObject("params");
        if (params == null) params = new JSONObject();

        JSONObject resp = new JSONObject();
        resp.put("id", id);
        try {
            Object result = dispatch(method, params);
            resp.put("ok", true);
            if (result != null) {
                if (result instanceof String) {
                    String s = (String) result;
                    String trimmed = s.trim();
                    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                        try {
                            resp.put("data", new org.json.JSONTokener(trimmed).nextValue());
                        } catch (Throwable t) {
                            resp.put("data", s);
                        }
                    } else {
                        resp.put("data", s);
                    }
                } else {
                    resp.put("data", result);
                }
            }
        } catch (Throwable t) {
            resp.put("ok", false);
            String msg = t.getMessage() != null ? t.getMessage() : String.valueOf(t);
            resp.put("error", msg);
        }
        try {
            synchronized (toGo) {
                toGo.write(resp.toString());
                toGo.write("\n");
                toGo.flush();
            }
        } catch (Throwable t) {
            DiagLog.write(ctx, "bridge: write threw " + t);
        }
    }

    private Object dispatch(String method, JSONObject p) throws Exception {
        switch (method) {
            case "batteryStatus": return api.batteryStatus();
            case "wifiInfo":      return api.wifiInfo();
            case "deviceInfo":    return api.deviceInfo();
            case "locationLast":  return api.locationLast();
            case "clipboardGet":  return api.clipboardGet();
            case "clipboardSet":
                api.clipboardSet(p.optString("text", ""));
                return null;
            case "toast":
                api.toast(p.optString("text", ""));
                return null;
            case "notify":
                api.notify(p.optString("title", ""), p.optString("body", ""));
                return null;
            case "vibrate":
                api.vibrate(p.optInt("ms", 100));
                return null;
            case "torch":
                api.torch(p.optBoolean("on", false));
                return null;
            case "tts":
                api.tts(p.optString("text", ""));
                return null;
            case "share":
                api.share(p.optString("title", ""), p.optString("text", ""));
                return null;
            case "cameraPhoto":
                return api.cameraPhoto(p.optString("path", ""));
            case "contactsList":
                return api.contactsList(p.optInt("limit", 20));
            case "callLogList":
                return api.callLogList(p.optInt("limit", 20));
            case "smsList":
                return api.smsList(p.optInt("limit", 20));
            case "smsSend":
                api.smsSend(p.optString("to", ""), p.optString("text", ""));
                return null;
            case "sensorsList": return api.sensorsList();
            case "sensorRead": return api.sensorRead(p.optString("name", ""), p.optInt("ms", 1000));
            case "systemInfo": return api.systemInfo();
            case "storageInfo": return api.storageInfo();
            case "networkInfo": return api.networkInfo();
            case "telephonyInfo": return api.telephonyInfo();
            case "displayInfo": return api.displayInfo();
            case "audioInfo": return api.audioInfo();
            case "featuresList": return api.featuresList();
            case "cameraList": return api.cameraList();
            case "batteryDetailed": return api.batteryDetailed();
            case "locationDetailed": return api.locationDetailed();
            case "localeInfo": return api.localeInfo();
            case "cpuDetail": return api.cpuDetail();
            case "thermalInfo": return api.thermalInfo();
            case "memoryDetail": return api.memoryDetail();
            case "wifiDetailed": return api.wifiDetailed();
            case "bluetoothInfo": return api.bluetoothInfo();
            case "displayBrightness": return api.displayBrightness();
            case "displayColor": return api.displayColor();
            case "microphoneList": return api.microphoneList();
            case "kernelInfo": return api.kernelInfo();
            case "microphoneRecord": return api.microphoneRecord(
                    p.optString("path", ""), p.optInt("seconds", 5));
            case "torchBrightness": return api.torchBrightness(p.optInt("level", 0));
            case "sensorStreamStart": return api.sensorStreamStart(
                    p.optString("name", ""), p.optInt("hz", 20));
            case "sensorStreamStop": return api.sensorStreamStop(p.optString("name", ""));
            case "audioVolume": return api.audioVolume(p.optInt("stream", 2));
            case "audioVolumeSet": return api.audioVolumeSet(
                    p.optInt("stream", 2), p.optInt("level", 5));
            case "audioRinger": return api.audioRinger();
            case "audioRingerSet": return api.audioRingerSet(p.optString("mode", "normal"));
            case "wifiScan": return api.wifiScan();
            case "appList": return api.appList();
            case "appLaunch": return api.appLaunch(p.optString("pkg", ""));
            case "netPing": return api.netPing(
                    p.optString("host", "8.8.8.8"), p.optInt("count", 4));
            case "netDns": return api.netDns(p.optString("host", ""));
            case "netFetch": return api.netFetch(p.optString("url", ""));
            case "calendarEvents": return api.calendarEvents(p.optInt("days", 7));
            case "alarmNext": return api.alarmNext();
            case "filesSave": return api.filesSave(
                    p.optString("name", ""), p.optString("data", ""));
            case "audioPlay": return api.audioPlay(p.optString("uri", ""));
            case "audioPlayStop": return api.audioPlayStop();
            case "ttsVoices": return api.ttsVoices();
            case "ttsStop": return api.ttsStop();
            case "clipboardWatchStart": return api.clipboardWatchStart(p.optInt("hz", 2));
            case "clipboardWatchStop": return api.clipboardWatchStop();
            case "locationWatchStart": return api.locationWatchStart(p.optInt("hz", 1));
            case "locationWatchStop": return api.locationWatchStop();
            default:
                throw new RuntimeException("unknown bridge method: " + method);
        }
    }
}
