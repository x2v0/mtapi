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

// MTAPI_HTTP_CACHE_71
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
		s.ok(w, data)
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
		s.ok(w, data)
	case "microphone/record":
		secs := intp(p, "seconds"); if secs <= 0 { secs = 5 }
		data, err := s.api.MicrophoneRecord(strp(p, "path"), secs)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "torch/brightness":
		lvl := intp(p, "level")
		data, err := s.api.TorchBrightness(lvl)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "sensors/stream":
		data, err := s.api.SensorStreamStart(strp(p, "name"), intp(p, "hz"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "sensors/stream/stop":
		data, err := s.api.SensorStreamStop(strp(p, "name"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "audio/volume":
		if _, has := p["level"]; has {
			data, err := s.api.AudioVolumeSet(intp(p, "stream"), intp(p, "level"))
			if err != nil { s.fail(w, 500, err); return }
			s.ok(w, data)
			return
		}
		data, err := s.api.AudioVolume(intp(p, "stream"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "audio/ringer":
		if mode := strp(p, "mode"); mode != "" {
			data, err := s.api.AudioRingerSet(mode)
			if err != nil { s.fail(w, 500, err); return }
			s.ok(w, data)
			return
		}
		data, err := s.api.AudioRinger()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "wifi/scan":
		data, err := s.api.WifiScan()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "app/list":
		data, err := s.api.AppList()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "app/launch":
		data, err := s.api.AppLaunch(strp(p, "pkg"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "net/ping":
		cnt := intp(p, "count"); if cnt <= 0 { cnt = 4 }
		data, err := s.api.NetPing(strp(p, "host"), cnt)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "net/dns":
		data, err := s.api.NetDns(strp(p, "host"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "net/fetch":
		data, err := s.api.NetFetch(strp(p, "url"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "calendar":
		days := intp(p, "days"); if days <= 0 { days = 7 }
		data, err := s.api.CalendarEvents(days)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "alarm/next":
		data, err := s.api.AlarmNext()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "files/save":
		data, err := s.api.FilesSave(strp(p, "name"), strp(p, "data"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "audio/play":
		data, err := s.api.AudioPlay(strp(p, "uri"))
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "audio/play/stop":
		data, err := s.api.AudioPlayStop()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "tts/voices":
		data, err := s.api.TTSVoices()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "tts/stop":
		data, err := s.api.TTSStop()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "clipboard/watch":
		hz := intp(p, "hz"); if hz <= 0 { hz = 2 }
		data, err := s.api.ClipboardWatchStart(hz)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "clipboard/watch/stop":
		data, err := s.api.ClipboardWatchStop()
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "location/watch":
		hz := intp(p, "hz"); if hz <= 0 { hz = 1 }
		data, err := s.api.LocationWatchStart(hz)
		if err != nil { s.fail(w, 500, err); return }
		s.ok(w, data)
	case "location/watch/stop":
		data, err := s.api.LocationWatchStop()
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
	html := strings.ReplaceAll(indexHTML, "{{TOKEN}}", s.token)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(html))
}

func startHTTP(api AndroidAPI, token string) error {
	s := &apiServer{api: api, token: token}
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/manifest.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/manifest+json")
		fmt.Fprint(w, manifestJSON)
	})
	mux.HandleFunc("/sw.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Service-Worker-Allowed", "/")
		fmt.Fprint(w, swJS)
	})
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
		"camera/snapshot", "microphone/record", "torch/brightness",
		// patch 42
		"sensors/stream", "sensors/stream/stop",
		"audio/volume", "audio/ringer",
		"wifi/scan", "app/list", "app/launch",
		"net/ping", "net/dns", "net/fetch",
		// patch 45
		"calendar", "alarm/next", "files/save",
		"audio/play", "audio/play/stop", "tts/voices", "tts/stop",
		"clipboard/watch", "clipboard/watch/stop",
		"location/watch", "location/watch/stop"}
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
