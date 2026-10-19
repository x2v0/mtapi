package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type apiServer struct {
	api   AndroidAPI
	token string
}

func (s *apiServer) checkAuth(r *http.Request) bool {
	if s.token == "" {
		return true // no auth configured
	}
	// Bearer header
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") && strings.TrimPrefix(auth, "Bearer ") == s.token {
		return true
	}
	// ?token= query (for browser convenience)
	if r.URL.Query().Get("token") == s.token {
		return true
	}
	return false
}

func (s *apiServer) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (s *apiServer) ok(w http.ResponseWriter, data string) {
	// Wrap raw JSON from AndroidAPI into {"ok":true,"data":<parsed>}.
	var parsed json.RawMessage
	if json.Valid([]byte(data)) {
		parsed = json.RawMessage(data)
	} else {
		b, _ := json.Marshal(data)
		parsed = b
	}
	s.writeJSON(w, 200, map[string]any{
		"ok":   true,
		"data": parsed,
	})
}

func (s *apiServer) fail(w http.ResponseWriter, status int, err error) {
	s.writeJSON(w, status, map[string]any{"ok": false, "error": err.Error()})
}

func (s *apiServer) handleCall(w http.ResponseWriter, r *http.Request) {
	if !s.checkAuth(r) {
		s.writeJSON(w, 401, map[string]any{"ok": false, "error": "auth_failed"})
		return
	}
	var req struct {
		Method string         `json:"method"`
		Params map[string]any `json:"params"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.fail(w, 400, err)
		return
	}
	s.dispatch(w, req.Method, req.Params)
}

func (s *apiServer) handleMethod(name string, fn func(http.ResponseWriter, map[string]any)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.checkAuth(r) {
			s.writeJSON(w, 401, map[string]any{"ok": false, "error": "auth_failed"})
			return
		}
		params := map[string]any{}
		for k, v := range r.URL.Query() {
			if len(v) > 0 {
				params[k] = v[0]
			}
		}
		if r.Method == "POST" {
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
				for k, v := range body {
					params[k] = v
				}
			}
		}
		fn(w, params)
	}
}

func strp(p map[string]any, key string) string {
	if v, ok := p[key].(string); ok {
		return v
	}
	return ""
}

func intp(p map[string]any, key string) int32 {
	switch v := p[key].(type) {
	case float64:
		return int32(v)
	case int:
		return int32(v)
	case string:
		n, _ := strconv.Atoi(v)
		return int32(n)
	}
	return 0
}

func boolp(p map[string]any, key string) bool {
	switch v := p[key].(type) {
	case bool:
		return v
	case string:
		return v == "1" || v == "true" || v == "yes"
	}
	return false
}

func (s *apiServer) dispatch(w http.ResponseWriter, method string, p map[string]any) {
	switch method {
	case "ping":
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": map[string]any{"pong": true}})
	case "battery":
		data, err := s.api.BatteryStatus()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "wifi":
		data, err := s.api.WifiInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "device":
		data, err := s.api.DeviceInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "location":
		data, err := s.api.LocationLast()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "clipboard":
		op := strp(p, "op")
		if op == "set" {
			if err := s.api.ClipboardSet(strp(p, "text")); err != nil { s.fail(w, 500, err); return }
			s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
			return
		}
		data, err := s.api.ClipboardGet()
		if err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": map[string]string{"text": data}})
	case "toast":
		if err := s.api.Toast(strp(p, "text")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "notify":
		if err := s.api.Notify(strp(p, "title"), strp(p, "body")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "vibrate":
		if err := s.api.Vibrate(intp(p, "ms")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "torch":
		if err := s.api.Torch(boolp(p, "on")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "tts":
		if err := s.api.TTS(strp(p, "text")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "share":
		if err := s.api.Share(strp(p, "title"), strp(p, "text")); err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
	case "camera":
		data, err := s.api.CameraPhoto(strp(p, "path"))
		if err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": data})
	case "contacts":
		lim := intp(p, "limit")
		if lim <= 0 { lim = 20 }
		data, err := s.api.ContactsList(lim)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "calllog":
		lim := intp(p, "limit")
		if lim <= 0 { lim = 20 }
		data, err := s.api.CallLogList(lim)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "sms":
		if strp(p, "op") == "send" {
			if err := s.api.SmsSend(strp(p, "to"), strp(p, "text")); err != nil { s.fail(w, 500, err); return }
			s.writeJSON(w, 200, map[string]any{"ok": true, "data": nil})
			return
		}
		lim := intp(p, "limit")
		if lim <= 0 { lim = 20 }
		data, err := s.api.SmsList(lim)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "sensors":
		data, err := s.api.SensorsList()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "sensors/read":
		ms := intp(p, "ms"); if ms <= 0 { ms = 1000 }
		data, err := s.api.SensorRead(strp(p, "name"), ms)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "system":
		data, err := s.api.SystemInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "storage":
		data, err := s.api.StorageInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "network":
		data, err := s.api.NetworkInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "telephony":
		data, err := s.api.TelephonyInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "display":
		data, err := s.api.DisplayInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "audio":
		data, err := s.api.AudioInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "features":
		data, err := s.api.FeaturesList()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "camera/list":
		data, err := s.api.CameraList()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "battery/detailed":
		data, err := s.api.BatteryDetailed()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "location/detailed":
		data, err := s.api.LocationDetailed()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "locale":
		data, err := s.api.LocaleInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "cpu/detail":
		data, err := s.api.CpuDetail()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "thermal":
		data, err := s.api.ThermalInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "memory":
		data, err := s.api.MemoryDetail()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "wifi/detailed":
		data, err := s.api.WifiDetailed()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "bluetooth":
		data, err := s.api.BluetoothInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "display/brightness":
		data, err := s.api.DisplayBrightness()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "display/color":
		data, err := s.api.DisplayColor()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "microphone":
		data, err := s.api.MicrophoneList()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "kernel":
		data, err := s.api.KernelInfo()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "camera/snapshot":
		data, err := s.api.CameraPhoto(strp(p, "path"))
		if err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": data})
	case "microphone/record":
		secs := intp(p, "seconds"); if secs <= 0 { secs = 5 }
		data, err := s.api.MicrophoneRecord(strp(p, "path"), secs)
		if err != nil { s.fail(w, 500, err); return }
		s.writeJSON(w, 200, map[string]any{"ok": true, "data": data})
	case "torch/brightness":
		lvl := intp(p, "level")
		data, err := s.api.TorchBrightness(lvl)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	default:
		s.writeJSON(w, 404, map[string]any{"ok": false, "error": "unknown method: " + method})
	}
}

func (s *apiServer) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>mtapi</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%}
  body{
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:14px;line-height:1.5;
    background:#1e1e1e;color:#ddd;
    -webkit-text-size-adjust:100%;
    -webkit-overflow-scrolling:touch;
    overflow-x:hidden;
    overflow-y:auto;
  }
  .wrap{
    max-width:720px;margin:0 auto;
    padding:16px 16px calc(32px + env(safe-area-inset-bottom));
    padding-top:calc(16px + env(safe-area-inset-top));
  }
  h1{font-size:20px;margin:8px 0 12px}
  h3{font-size:15px;margin:20px 0 8px;color:#aaa;text-transform:uppercase;letter-spacing:.05em}
  a{color:#4fc3f7;text-decoration:none;word-break:break-all}
  a:active{opacity:.7}
  code{
    background:#2a2a2a;padding:2px 6px;border-radius:4px;
    word-break:break-all;color:#ce9178;
  }
  ul{list-style:none;padding:0;margin:0}
  li{padding:10px 12px;background:#252525;border-radius:6px;margin-bottom:8px;word-break:break-word}
  li a{font-weight:600}
  pre{
    background:#252525;padding:12px;border-radius:6px;
    overflow-x:auto;font-size:12px;margin:8px 0;
    white-space:pre-wrap;word-break:break-all;
  }
  .token-box{
    background:#2a2a2a;padding:12px;border-radius:6px;margin:8px 0;
    word-break:break-all;font-size:12px;
    -webkit-user-select:all;user-select:all;
  }
  .hint{color:#888;font-size:12px;margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
  <h1>mtapi server</h1>
  <p class="hint">Token (tap to select):</p>
  <div class="token-box">%s</div>

  <h3>Health / Info</h3>
  <ul>
    <li><a href="/ping?token=%s">/ping</a> — health check</li>
    <li><a href="/battery?token=%s">/battery</a> — battery status</li>
    <li><a href="/wifi?token=%s">/wifi</a> — wifi info</li>
    <li><a href="/device?token=%s">/device</a> — device info</li>
    <li><a href="/location?token=%s">/location</a> — last location</li>
  </ul>

  <h3>Data</h3>
  <ul>
    <li><a href="/clipboard?token=%s">/clipboard</a> — GET; <code>/clipboard?op=set&amp;text=hello</code> — SET</li>
    <li><a href="/contacts?limit=5&amp;token=%s">/contacts?limit=5</a> — contacts</li>
    <li><a href="/calllog?limit=5&amp;token=%s">/calllog?limit=5</a> — recent calls</li>
    <li><a href="/sms?limit=5&amp;token=%s">/sms?limit=5</a> — SMS list; <code>/sms?op=send&amp;to=%2B100&amp;text=yo</code> — SEND</li>
  </ul>

  <h3>System info</h3>
  <ul>
    <li><a href="/system?token=%s">/system</a> — CPU/RAM/build</li>
    <li><a href="/cpu/detail?token=%s">/cpu/detail</a> — per-core freq</li>
    <li><a href="/thermal?token=%s">/thermal</a> — thermal zones</li>
    <li><a href="/memory?token=%s">/memory</a> — meminfo</li>
    <li><a href="/storage?token=%s">/storage</a></li>
    <li><a href="/kernel?token=%s">/kernel</a></li>
    <li><a href="/sensors?token=%s">/sensors</a> — all sensors</li>
    <li><a href="/network?token=%s">/network</a></li>
    <li><a href="/wifi/detailed?token=%s">/wifi/detailed</a></li>
    <li><a href="/bluetooth?token=%s">/bluetooth</a></li>
    <li><a href="/telephony?token=%s">/telephony</a></li>
    <li><a href="/display?token=%s">/display</a></li>
    <li><a href="/display/brightness?token=%s">/display/brightness</a></li>
    <li><a href="/display/color?token=%s">/display/color</a></li>
    <li><a href="/audio?token=%s">/audio</a></li>
    <li><a href="/microphone?token=%s">/microphone</a></li>
    <li><a href="/features?token=%s">/features</a></li>
    <li><a href="/camera/list?token=%s">/camera/list</a></li>
    <li><a href="/battery/detailed?token=%s">/battery/detailed</a></li>
    <li><a href="/location/detailed?token=%s">/location/detailed</a></li>
    <li><a href="/locale?token=%s">/locale</a></li>
  </ul>

  <h3>Actions</h3>
  <ul>
    <li><a href="/toast?text=hi&amp;token=%s">/toast</a></li>
    <li><a href="/notify?title=Hi&amp;body=World&amp;token=%s">/notify</a></li>
    <li><a href="/vibrate?ms=200&amp;token=%s">/vibrate</a></li>
    <li><a href="/torch?on=1&amp;token=%s">/torch</a> on/off</li>
    <li><a href="/torch/brightness?level=50&amp;token=%s">/torch/brightness?level=50</a></li>
    <li><a href="/tts?text=hello&amp;token=%s">/tts</a></li>
  </ul>

  <h3>Hardware (slow — few seconds)</h3>
  <ul>
    <li><a href="/camera/snapshot?token=%s">/camera/snapshot</a> — takes photo</li>
    <li><a href="/microphone/record?seconds=3&amp;token=%s">/microphone/record?seconds=3</a> — records 3s</li>
    <li><a href="/sensors/read?name=accelerometer&amp;ms=500&amp;token=%s">/sensors/read?name=accelerometer&amp;ms=500</a></li>
  </ul>

  <h3>POST /call (JSON-RPC)</h3>
  <pre>curl -X POST http://127.0.0.1:7788/call \
  -H "Authorization: Bearer %s" \
  -d '{"method":"battery"}'</pre>
</div>
</body>
</html>`, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token, s.token)
}

func startHTTP(api AndroidAPI, token string) error {
	s := &apiServer{api: api, token: token}
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/call", s.handleCall)

	// convenience routes
	methods := []string{"ping", "battery", "wifi", "device", "location",
		"clipboard", "toast", "notify", "vibrate", "torch", "tts", "share",
		"camera", "contacts", "calllog", "sms",
		// extended info
		"sensors", "sensors/read", "system", "storage", "network",
		"telephony", "display", "audio", "features",
		"camera/list", "battery/detailed", "location/detailed", "locale",
		// patch 36
		"cpu/detail", "thermal", "memory", "wifi/detailed", "bluetooth",
		"display/brightness", "display/color", "microphone", "kernel",
		// patch 38
		"camera/snapshot", "microphone/record", "torch/brightness"}
	for _, m := range methods {
		m := m
		mux.HandleFunc("/"+m, s.handleMethod(m, func(w http.ResponseWriter, p map[string]any) {
			s.dispatch(w, m, p)
		}))
	}

	addr := "127.0.0.1:7788"
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}
	srv := &http.Server{Handler: mux}
	log.Printf("HTTP: http://%s", addr)

	// background: also confirm PID file path
	if p := os.Getenv("MTAPI_PIDFILE"); p != "" {
		os.WriteFile(p, []byte(fmt.Sprintf("%d", os.Getpid())), 0644)
	}

	go func() {
		_ = time.AfterFunc(0, func() {})
	}()
	return srv.Serve(ln)
}
