// Package main is the JNI bridge between gocore/mobile and Java.
//
// Compiled with:
//   go build -buildmode=c-shared -o libgojni.so ./jni
//
// Replaces `gomobile bind` for Termux/ARM64 hosts.
//
// Java side calls:
//   Mobile.nativeStart(token, androidApiImpl)  // -> 0 on success, -1 on error
//   Mobile.nativeStop()
//   Mobile.nativePing() -> String
//
// jniAPI implements mobile.AndroidAPI by calling Java methods on AndroidApiImpl.
package main

/*
#cgo LDFLAGS: -llog -landroid

#include <stdlib.h>
#include <string.h>
#include <jni.h>

// ── string helpers ─────────────────────────────────────
static char* go_str_dup(jstring s, JNIEnv* env) {
    if (s == NULL) return NULL;
    const char* c = (*env)->GetStringUTFChars(env, s, NULL);
    if (c == NULL) return NULL;
    char* out = strdup(c);
    (*env)->ReleaseStringUTFChars(env, s, c);
    return out;
}
static jstring go_str_return(const char* s, JNIEnv* env) {
    if (s == NULL) return NULL;
    return (*env)->NewStringUTF(env, s);
}

// ── JNIEnv lifecycle ───────────────────────────────────
static jint jni_get_java_vm(JNIEnv* env, JavaVM** vm) {
    return (*env)->GetJavaVM(env, vm);
}
static jint jni_attach_current_thread(JavaVM* vm, JNIEnv** env) {
    return (*vm)->AttachCurrentThread(vm, env, NULL);
}
static jint jni_detach_current_thread(JavaVM* vm) {
    return (*vm)->DetachCurrentThread(vm);
}
static jobject jni_new_global_ref(JNIEnv* env, jobject obj) {
    return (*env)->NewGlobalRef(env, obj);
}
static void jni_delete_global_ref(JNIEnv* env, jobject obj) {
    (*env)->DeleteGlobalRef(env, obj);
}

// ── class/method lookup ────────────────────────────────
static jclass jni_get_object_class(JNIEnv* env, jobject obj) {
    return (*env)->GetObjectClass(env, obj);
}
static jmethodID jni_get_method_id(JNIEnv* env, jclass cls, const char* name, const char* sig) {
    return (*env)->GetMethodID(env, cls, name, sig);
}

// ── calls, one wrapper per signature ───────────────────
static jobject call_str_noarg(JNIEnv* env, jobject obj, jmethodID mid) {
    return (*env)->CallObjectMethod(env, obj, mid);
}
static jobject call_str_str(JNIEnv* env, jobject obj, jmethodID mid, jstring a) {
    return (*env)->CallObjectMethod(env, obj, mid, a);
}
static jobject call_str_int(JNIEnv* env, jobject obj, jmethodID mid, jint n) {
    return (*env)->CallObjectMethod(env, obj, mid, n);
}
static void call_void_noarg(JNIEnv* env, jobject obj, jmethodID mid) {
    (*env)->CallVoidMethod(env, obj, mid);
}
static void call_void_str(JNIEnv* env, jobject obj, jmethodID mid, jstring a) {
    (*env)->CallVoidMethod(env, obj, mid, a);
}
static void call_void_int(JNIEnv* env, jobject obj, jmethodID mid, jint n) {
    (*env)->CallVoidMethod(env, obj, mid, n);
}
static void call_void_bool(JNIEnv* env, jobject obj, jmethodID mid, jboolean b) {
    (*env)->CallVoidMethod(env, obj, mid, b);
}
static void call_void_two_str(JNIEnv* env, jobject obj, jmethodID mid, jstring a, jstring b) {
    (*env)->CallVoidMethod(env, obj, mid, a, b);
}

// ── string access ──────────────────────────────────────
static const char* jni_get_string_utf(JNIEnv* env, jstring s) {
    return (*env)->GetStringUTFChars(env, s, NULL);
}
static void jni_release_string_utf(JNIEnv* env, jstring s, const char* c) {
    (*env)->ReleaseStringUTFChars(env, s, c);
}

// ── exception handling ─────────────────────────────────
static jboolean jni_exception_check(JNIEnv* env) {
    return (*env)->ExceptionCheck(env);
}
static void jni_exception_clear(JNIEnv* env) {
    (*env)->ExceptionClear(env);
}
static void jni_exception_describe(JNIEnv* env) {
    (*env)->ExceptionDescribe(env);
}

// ── misc ───────────────────────────────────────────────
static void jni_set_boolean_field_by_name(JNIEnv* env, jobject obj, const char* name, jboolean v) {
    jclass cls = (*env)->GetObjectClass(env, obj);
    jfieldID fid = (*env)->GetFieldID(env, cls, name, "Z");
    if (fid != NULL) (*env)->SetBooleanField(env, obj, fid, v);
}
*/
import "C"

import (
	"errors"
	"fmt"
	"sync"

	"mtapi/gocore/mobile"
)

// ═══════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════

var (
	mu       sync.RWMutex
	bridge   *jniAPI
)

type jniAPI struct {
	vm    *C.JavaVM
	obj   C.jobject
	mu    sync.Mutex // serializes JNI calls for this bridge
}

// ═══════════════════════════════════════════════════════
// attach/detach JNIEnv for current thread
// ═══════════════════════════════════════════════════════

func (j *jniAPI) attach() (*C.JNIEnv, func()) {
	var env *C.JNIEnv
	if C.jni_attach_current_thread(j.vm, &env) != 0 {
		return nil, func() {}
	}
	return env, func() { C.jni_detach_current_thread(j.vm) }
}

// ═══════════════════════════════════════════════════════
// Low-level JNI helpers
// ═══════════════════════════════════════════════════════

func cstr(s string) *C.char { return C.CString(s) }

func jstringToGo(env *C.JNIEnv, s C.jobject) string {
	if s == 0 {
		return ""
	}
	js := C.jstring(s)
	cs := C.jni_get_string_utf(env, js)
	if cs == nil {
		return ""
	}
	defer C.jni_release_string_utf(env, js, cs)
	return C.GoString(cs)
}

func goToJstring(env *C.JNIEnv, s string) C.jstring {
	return C.go_str_return(cstr(s), env)
}

func (j *jniAPI) lookup(env *C.JNIEnv, name, sig string) C.jmethodID {
	cls := C.jni_get_object_class(env, j.obj)
	return C.jni_get_method_id(env, cls, cstr(name), cstr(sig))
}

func checkException(env *C.JNIEnv) error {
	if C.jni_exception_check(env) == 0 {
		return nil
	}
	C.jni_exception_describe(env)
	C.jni_exception_clear(env)
	return errors.New("java_exception")
}

// ── call variants ──────────────────────────────────────

func (j *jniAPI) callStrNoArg(method string) (string, error) {
	env, detach := j.attach()
	if env == nil { return "", errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "()Ljava/lang/String;")
	res := C.call_str_noarg(env, j.obj, mid)
	if err := checkException(env); err != nil { return "", err }
	return jstringToGo(env, res), nil
}

func (j *jniAPI) callStrStr(method, a string) (string, error) {
	env, detach := j.attach()
	if env == nil { return "", errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(Ljava/lang/String;)Ljava/lang/String;")
	res := C.call_str_str(env, j.obj, mid, goToJstring(env, a))
	if err := checkException(env); err != nil { return "", err }
	return jstringToGo(env, res), nil
}

func (j *jniAPI) callStrInt(method string, n int32) (string, error) {
	env, detach := j.attach()
	if env == nil { return "", errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(I)Ljava/lang/String;")
	res := C.call_str_int(env, j.obj, mid, C.jint(n))
	if err := checkException(env); err != nil { return "", err }
	return jstringToGo(env, res), nil
}

func (j *jniAPI) callVoidNoArg(method string) error {
	env, detach := j.attach()
	if env == nil { return errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "()V")
	C.call_void_noarg(env, j.obj, mid)
	return checkException(env)
}

func (j *jniAPI) callVoidStr(method, a string) error {
	env, detach := j.attach()
	if env == nil { return errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(Ljava/lang/String;)V")
	C.call_void_str(env, j.obj, mid, goToJstring(env, a))
	return checkException(env)
}

func (j *jniAPI) callVoidInt(method string, n int32) error {
	env, detach := j.attach()
	if env == nil { return errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(I)V")
	C.call_void_int(env, j.obj, mid, C.jint(n))
	return checkException(env)
}

func (j *jniAPI) callVoidBool(method string, b bool) error {
	env, detach := j.attach()
	if env == nil { return errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(Z)V")
	var jb C.jboolean
	if b { jb = 1 } else { jb = 0 }
	C.call_void_bool(env, j.obj, mid, jb)
	return checkException(env)
}

func (j *jniAPI) callVoidTwoStr(method, a, b string) error {
	env, detach := j.attach()
	if env == nil { return errors.New("attach_failed") }
	defer detach()
	mid := j.lookup(env, method, "(Ljava/lang/String;Ljava/lang/String;)V")
	C.call_void_two_str(env, j.obj, mid, goToJstring(env, a), goToJstring(env, b))
	return checkException(env)
}

// ═══════════════════════════════════════════════════════
// mobile.AndroidAPI implementation
// ═══════════════════════════════════════════════════════

func (j *jniAPI) BatteryStatus() (string, error)  { return j.callStrNoArg("batteryStatus") }
func (j *jniAPI) WifiInfo() (string, error)       { return j.callStrNoArg("wifiInfo") }
func (j *jniAPI) DeviceInfo() (string, error)     { return j.callStrNoArg("deviceInfo") }
func (j *jniAPI) LocationLast() (string, error)   { return j.callStrNoArg("locationLast") }
func (j *jniAPI) ClipboardGet() (string, error)   { return j.callStrNoArg("clipboardGet") }

func (j *jniAPI) ClipboardSet(text string) error  { return j.callVoidStr("clipboardSet", text) }
func (j *jniAPI) Toast(text string) error         { return j.callVoidStr("toast", text) }
func (j *jniAPI) TTS(text string) error           { return j.callVoidStr("tts", text) }
func (j *jniAPI) Vibrate(ms int32) error          { return j.callVoidInt("vibrate", ms) }
func (j *jniAPI) Torch(on bool) error             { return j.callVoidBool("torch", on) }

func (j *jniAPI) Notify(title, body string) error { return j.callVoidTwoStr("notify", title, body) }
func (j *jniAPI) Share(title, text string) error  { return j.callVoidTwoStr("share", title, text) }
func (j *jniAPI) SmsSend(to, text string) error   { return j.callVoidTwoStr("smsSend", to, text) }

func (j *jniAPI) CameraPhoto(path string) (string, error) {
	return j.callStrStr("cameraPhoto", path)
}
func (j *jniAPI) ContactsList(limit int32) (string, error) {
	return j.callStrInt("contactsList", limit)
}
func (j *jniAPI) CallLogList(limit int32) (string, error) {
	return j.callStrInt("callLogList", limit)
}
func (j *jniAPI) SmsList(limit int32) (string, error) {
	return j.callStrInt("smsList", limit)
}

// compile-time check
var _ mobile.AndroidAPI = (*jniAPI)(nil)

// ═══════════════════════════════════════════════════════
// JNI entry points
// ═══════════════════════════════════════════════════════

//export Java_dev_mtapi_Mobile_nativeStart
func Java_dev_mtapi_Mobile_nativeStart(
	env *C.JNIEnv, cls C.jclass, token C.jstring, apiObj C.jobject,
) C.jint {
	var vm *C.JavaVM
	if C.jni_get_java_vm(env, &vm) != 0 || vm == nil {
		return -1
	}
	gobj := C.jni_new_global_ref(env, apiObj)
	if gobj == 0 {
		return -1
	}

	tok := C.GoString(C.go_str_dup(token, env))
	br := &jniAPI{vm: vm, obj: gobj}

	if err := mobile.Start(tok, br); err != nil {
		C.jni_delete_global_ref(env, gobj)
		return -1
	}

	mu.Lock()
	bridge = br
	mu.Unlock()
	return 0
}

//export Java_dev_mtapi_Mobile_nativeStop
func Java_dev_mtapi_Mobile_nativeStop(env *C.JNIEnv, cls C.jclass) {
	mobile.Stop()

	mu.Lock()
	br := bridge
	bridge = nil
	mu.Unlock()

	if br != nil && br.obj != 0 {
		C.jni_delete_global_ref(env, br.obj)
	}
}

//export Java_dev_mtapi_Mobile_nativePing
func Java_dev_mtapi_Mobile_nativePing(env *C.JNIEnv, cls C.jclass) C.jstring {
	s := fmt.Sprintf("mtapi/%s", mobile.Version)
	return goToJstring(env, s)
}

func main() {}
