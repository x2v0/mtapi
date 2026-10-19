package main

import (
	"fmt"
	"strconv"
)

// AndroidAPI mirrors gocore/mobile.AndroidAPI (17 methods).
// Implemented here by bridgeAPI via JSON-RPC over stdio to Java.
type AndroidAPI interface {
	BatteryStatus() (string, error)
	WifiInfo() (string, error)
	DeviceInfo() (string, error)
	LocationLast() (string, error)
	ClipboardGet() (string, error)
	ClipboardSet(text string) error
	Toast(text string) error
	Notify(title, body string) error
	Vibrate(ms int32) error
	Torch(on bool) error
	TTS(text string) error
	Share(title, text string) error
	CameraPhoto(path string) (string, error)
	ContactsList(limit int32) (string, error)
	CallLogList(limit int32) (string, error)
	SmsList(limit int32) (string, error)
	SmsSend(to, text string) error
}

type bridgeAPI struct{ b *bridge }

func (a *bridgeAPI) BatteryStatus() (string, error) { return a.b.callStr("batteryStatus", nil) }
func (a *bridgeAPI) WifiInfo() (string, error)      { return a.b.callStr("wifiInfo", nil) }
func (a *bridgeAPI) DeviceInfo() (string, error)    { return a.b.callStr("deviceInfo", nil) }
func (a *bridgeAPI) LocationLast() (string, error)  { return a.b.callStr("locationLast", nil) }
func (a *bridgeAPI) ClipboardGet() (string, error)  { return a.b.callStr("clipboardGet", nil) }

func (a *bridgeAPI) ClipboardSet(text string) error {
	return a.b.callVoid("clipboardSet", map[string]any{"text": text})
}
func (a *bridgeAPI) Toast(text string) error {
	return a.b.callVoid("toast", map[string]any{"text": text})
}
func (a *bridgeAPI) Notify(title, body string) error {
	return a.b.callVoid("notify", map[string]any{"title": title, "body": body})
}
func (a *bridgeAPI) Vibrate(ms int32) error {
	return a.b.callVoid("vibrate", map[string]any{"ms": ms})
}
func (a *bridgeAPI) Torch(on bool) error {
	return a.b.callVoid("torch", map[string]any{"on": on})
}
func (a *bridgeAPI) TTS(text string) error {
	return a.b.callVoid("tts", map[string]any{"text": text})
}
func (a *bridgeAPI) Share(title, text string) error {
	return a.b.callVoid("share", map[string]any{"title": title, "text": text})
}
func (a *bridgeAPI) CameraPhoto(path string) (string, error) {
	return a.b.callStr("cameraPhoto", map[string]any{"path": path})
}
func (a *bridgeAPI) ContactsList(limit int32) (string, error) {
	return a.b.callStr("contactsList", map[string]any{"limit": limit})
}
func (a *bridgeAPI) CallLogList(limit int32) (string, error) {
	return a.b.callStr("callLogList", map[string]any{"limit": limit})
}
func (a *bridgeAPI) SmsList(limit int32) (string, error) {
	return a.b.callStr("smsList", map[string]any{"limit": limit})
}
func (a *bridgeAPI) SmsSend(to, text string) error {
	return a.b.callVoid("smsSend", map[string]any{"to": to, "text": text})
}

// int32 helper
func _atoi32(s string) int32 {
	n, _ := strconv.Atoi(s)
	return int32(n)
}

var _ = fmt.Sprintf
var _ = _atoi32
