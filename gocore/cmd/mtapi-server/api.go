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

	// Extended info (patch 34)
	SensorsList() (string, error)
	SensorRead(name string, ms int32) (string, error)
	SystemInfo() (string, error)
	StorageInfo() (string, error)
	NetworkInfo() (string, error)
	TelephonyInfo() (string, error)
	DisplayInfo() (string, error)
	AudioInfo() (string, error)
	FeaturesList() (string, error)
	CameraList() (string, error)
	BatteryDetailed() (string, error)
	LocationDetailed() (string, error)
	LocaleInfo() (string, error)

	// Patch 36
	CpuDetail() (string, error)
	ThermalInfo() (string, error)
	MemoryDetail() (string, error)
	WifiDetailed() (string, error)
	BluetoothInfo() (string, error)
	DisplayBrightness() (string, error)
	DisplayColor() (string, error)
	MicrophoneList() (string, error)
	KernelInfo() (string, error)

	// Patch 38
	MicrophoneRecord(path string, seconds int32) (string, error)
	TorchBrightness(level int32) (string, error)

	// Patch 42
	SensorStreamStart(name string, hz int32) (string, error)
	SensorStreamStop(name string) (string, error)
	AudioVolume(stream int32) (string, error)
	AudioVolumeSet(stream, level int32) (string, error)
	AudioRinger() (string, error)
	AudioRingerSet(mode string) (string, error)
	WifiScan() (string, error)
	AppList() (string, error)
	AppLaunch(pkg string) (string, error)
	NetPing(host string, count int32) (string, error)
	NetDns(host string) (string, error)
	NetFetch(url string) (string, error)
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
func (a *bridgeAPI) SensorsList() (string, error) { return a.b.callStr("sensorsList", nil) }
func (a *bridgeAPI) SensorRead(name string, ms int32) (string, error) {
	return a.b.callStr("sensorRead", map[string]any{"name": name, "ms": ms})
}
func (a *bridgeAPI) SystemInfo() (string, error)     { return a.b.callStr("systemInfo", nil) }
func (a *bridgeAPI) StorageInfo() (string, error)    { return a.b.callStr("storageInfo", nil) }
func (a *bridgeAPI) NetworkInfo() (string, error)    { return a.b.callStr("networkInfo", nil) }
func (a *bridgeAPI) TelephonyInfo() (string, error)  { return a.b.callStr("telephonyInfo", nil) }
func (a *bridgeAPI) DisplayInfo() (string, error)    { return a.b.callStr("displayInfo", nil) }
func (a *bridgeAPI) AudioInfo() (string, error)      { return a.b.callStr("audioInfo", nil) }
func (a *bridgeAPI) FeaturesList() (string, error)   { return a.b.callStr("featuresList", nil) }
func (a *bridgeAPI) CameraList() (string, error)     { return a.b.callStr("cameraList", nil) }
func (a *bridgeAPI) BatteryDetailed() (string, error){ return a.b.callStr("batteryDetailed", nil) }
func (a *bridgeAPI) LocationDetailed() (string, error){ return a.b.callStr("locationDetailed", nil) }
func (a *bridgeAPI) LocaleInfo() (string, error)     { return a.b.callStr("localeInfo", nil) }

func (a *bridgeAPI) CpuDetail() (string, error)        { return a.b.callStr("cpuDetail", nil) }
func (a *bridgeAPI) ThermalInfo() (string, error)      { return a.b.callStr("thermalInfo", nil) }
func (a *bridgeAPI) MemoryDetail() (string, error)     { return a.b.callStr("memoryDetail", nil) }
func (a *bridgeAPI) WifiDetailed() (string, error)     { return a.b.callStr("wifiDetailed", nil) }
func (a *bridgeAPI) BluetoothInfo() (string, error)    { return a.b.callStr("bluetoothInfo", nil) }
func (a *bridgeAPI) DisplayBrightness() (string, error){ return a.b.callStr("displayBrightness", nil) }
func (a *bridgeAPI) DisplayColor() (string, error)     { return a.b.callStr("displayColor", nil) }
func (a *bridgeAPI) MicrophoneList() (string, error)   { return a.b.callStr("microphoneList", nil) }
func (a *bridgeAPI) KernelInfo() (string, error)       { return a.b.callStr("kernelInfo", nil) }

func (a *bridgeAPI) MicrophoneRecord(path string, seconds int32) (string, error) {
	return a.b.callStr("microphoneRecord", map[string]any{"path": path, "seconds": seconds})
}
func (a *bridgeAPI) TorchBrightness(level int32) (string, error) {
	return a.b.callStr("torchBrightness", map[string]any{"level": level})
}

func (a *bridgeAPI) SensorStreamStart(name string, hz int32) (string, error) {
	return a.b.callStr("sensorStreamStart", map[string]any{"name": name, "hz": hz})
}
func (a *bridgeAPI) SensorStreamStop(name string) (string, error) {
	return a.b.callStr("sensorStreamStop", map[string]any{"name": name})
}
func (a *bridgeAPI) AudioVolume(stream int32) (string, error) {
	return a.b.callStr("audioVolume", map[string]any{"stream": stream})
}
func (a *bridgeAPI) AudioVolumeSet(stream, level int32) (string, error) {
	return a.b.callStr("audioVolumeSet", map[string]any{"stream": stream, "level": level})
}
func (a *bridgeAPI) AudioRinger() (string, error) { return a.b.callStr("audioRinger", nil) }
func (a *bridgeAPI) AudioRingerSet(mode string) (string, error) {
	return a.b.callStr("audioRingerSet", map[string]any{"mode": mode})
}
func (a *bridgeAPI) WifiScan() (string, error) { return a.b.callStr("wifiScan", nil) }
func (a *bridgeAPI) AppList() (string, error)  { return a.b.callStr("appList", nil) }
func (a *bridgeAPI) AppLaunch(pkg string) (string, error) {
	return a.b.callStr("appLaunch", map[string]any{"pkg": pkg})
}
func (a *bridgeAPI) NetPing(host string, count int32) (string, error) {
	return a.b.callStr("netPing", map[string]any{"host": host, "count": count})
}
func (a *bridgeAPI) NetDns(host string) (string, error) {
	return a.b.callStr("netDns", map[string]any{"host": host})
}
func (a *bridgeAPI) NetFetch(url string) (string, error) {
	return a.b.callStr("netFetch", map[string]any{"url": url})
}

func _atoi32(s string) int32 {
	n, _ := strconv.Atoi(s)
	return int32(n)
}

var _ = fmt.Sprintf
var _ = _atoi32
