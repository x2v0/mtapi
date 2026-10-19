package dev.mtapi;

/**
 * Must match gocore/jni/main.go jniAPI implementation exactly.
 * Called from Go via JNI (CallObjectMethod).
 */
public interface AndroidAPI {
    String batteryStatus() throws Exception;
    String wifiInfo() throws Exception;
    String deviceInfo() throws Exception;
    String locationLast() throws Exception;
    String clipboardGet() throws Exception;

    void clipboardSet(String text) throws Exception;
    void toast(String text) throws Exception;
    void tts(String text) throws Exception;
    void vibrate(int ms) throws Exception;
    void torch(boolean on) throws Exception;

    void notify(String title, String body) throws Exception;
    void share(String title, String text) throws Exception;
    void smsSend(String to, String text) throws Exception;

    String cameraPhoto(String path) throws Exception;
    String contactsList(int limit) throws Exception;
    String callLogList(int limit) throws Exception;
    String smsList(int limit) throws Exception;
}
