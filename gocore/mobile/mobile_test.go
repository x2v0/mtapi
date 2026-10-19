package mobile

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

type mockAPI struct {
	batteryJSON   string
	batteryErr    error
	clipboardText string
	clipboardErr  error
	lastToast     string
	toastErr      error
	vibratedMs    int32
	torchOn       bool
}

func (m *mockAPI) BatteryStatus() (string, error)   { return m.batteryJSON, m.batteryErr }
func (m *mockAPI) WifiInfo() (string, error)        { return `{"ssid":"x","rssi":-50}`, nil }
func (m *mockAPI) ClipboardGet() (string, error)    { return m.clipboardText, m.clipboardErr }
func (m *mockAPI) ClipboardSet(s string) error      { m.clipboardText = s; return m.clipboardErr }
func (m *mockAPI) Toast(s string) error             { m.lastToast = s; return m.toastErr }
func (m *mockAPI) Notify(t, b string) error         { return nil }
func (m *mockAPI) Vibrate(ms int32) error           { m.vibratedMs = ms; return nil }
func (m *mockAPI) Torch(on bool) error              { m.torchOn = on; return nil }
func (m *mockAPI) DeviceInfo() (string, error)      { return `{"model":"x"}`, nil }
func (m *mockAPI) LocationLast() (string, error)    { return `{"lat":1,"lon":2}`, nil }
func (m *mockAPI) TTS(s string) error               { return nil }
func (m *mockAPI) Share(t, x string) error          { return nil }
func (m *mockAPI) CameraPhoto(p string) (string, error) { return p, nil }
func (m *mockAPI) ContactsList(limit int32) (string, error) {
	return `[{"name":"Alice","phone":"+100"},{"name":"Bob","phone":"+200"}]`, nil
}
func (m *mockAPI) CallLogList(limit int32) (string, error) {
	return `[{"number":"+100","type":1,"ts":1700000000,"duration":30}]`, nil
}
func (m *mockAPI) SmsList(limit int32) (string, error) {
	return `[{"address":"+100","body":"hi","ts":1700000000,"type":1}]`, nil
}
func (m *mockAPI) SmsSend(to, text string) error { return nil }

func setup(t *testing.T) *mockAPI {
	t.Helper()
	m := &mockAPI{batteryJSON: `{"percentage":42,"charging":true}`}
	mu.Lock()
	api = m
	mu.Unlock()
	t.Cleanup(func() {
		mu.Lock()
		api = nil
		mu.Unlock()
	})
	return m
}

func mkReq(t *testing.T, method string, params any) *request {
	t.Helper()
	var raw []byte
	if params != nil {
		var err error
		raw, err = json.Marshal(params)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
	}
	return &request{Method: method, Params: raw}
}

func TestDispatch_Ping(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "ping", nil))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "pong") {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_Battery(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "battery", nil))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), `"percentage":42`) {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_Unknown(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "nope", nil))
	if r.OK {
		t.Fatal("expected error")
	}
	if !strings.Contains(r.Error, "unknown method") {
		t.Fatalf("err: %q", r.Error)
	}
}

func TestDispatch_NoAPI(t *testing.T) {
	mu.Lock()
	api = nil
	mu.Unlock()
	r := dispatch(mkReq(t, "ping", nil))
	if r.OK || r.Error != "not_initialized" {
		t.Fatalf("got %+v", r)
	}
}

func TestDispatch_Toast(t *testing.T) {
	m := setup(t)
	r := dispatch(mkReq(t, "toast", map[string]string{"text": "hi"}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if m.lastToast != "hi" {
		t.Fatalf("toast: %q", m.lastToast)
	}
}

func TestDispatch_Clipboard(t *testing.T) {
	m := setup(t)
	r := dispatch(mkReq(t, "clipboard", map[string]string{"op": "set", "text": "hello"}))
	if !r.OK {
		t.Fatalf("set: %q", r.Error)
	}
	if m.clipboardText != "hello" {
		t.Fatalf("clipboard: %q", m.clipboardText)
	}
	r = dispatch(mkReq(t, "clipboard", map[string]string{"op": "get"}))
	if !r.OK {
		t.Fatalf("get: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "hello") {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_APIFailure(t *testing.T) {
	m := setup(t)
	m.batteryErr = errors.New("boom")
	r := dispatch(mkReq(t, "battery", nil))
	if r.OK || r.Error != "boom" {
		t.Fatalf("got %+v", r)
	}
}

func TestDispatch_Contacts(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "contacts", map[string]int{"limit": 5}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "Alice") {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_CallLog(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "calllog", map[string]int{"limit": 5}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "duration") {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_SmsList(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "sms", map[string]interface{}{"op": "list", "limit": 3}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "hi") {
		t.Fatalf("data: %s", r.Data)
	}
}

func TestDispatch_SmsSend(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "sms", map[string]string{"op": "send", "to": "+100", "text": "yo"}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
}

func TestDispatch_Camera(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "camera", map[string]string{"path": "/tmp/x.jpg"}))
	if !r.OK {
		t.Fatalf("not ok: %q", r.Error)
	}
	if !strings.Contains(string(r.Data), "/tmp/x.jpg") {
		t.Fatalf("data: %s", r.Data)
	}
}

// Regression: response.Data must serialize as raw JSON object, not base64 string.
// Previously Data was []byte alias, and json.Marshal encoded it as base64 —
// breaking every real client silently (unit tests didn't catch it).
func TestDispatchResponse_JSONFormat(t *testing.T) {
	setup(t)
	r := dispatch(mkReq(t, "ping", nil))
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(b), "eyJ") {
		t.Fatalf("data appears base64-encoded: %s", b)
	}
	if !strings.Contains(string(b), `"data":{"pong":true}`) {
		t.Fatalf("data must be raw JSON, got: %s", b)
	}
}
