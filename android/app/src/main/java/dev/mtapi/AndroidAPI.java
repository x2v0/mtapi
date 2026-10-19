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
    // Extended info (patch 34)
    String sensorsList() throws Exception;
    String sensorRead(String name, int ms) throws Exception;
    String systemInfo() throws Exception;
    String storageInfo() throws Exception;
    String networkInfo() throws Exception;
    String telephonyInfo() throws Exception;
    String displayInfo() throws Exception;
    String audioInfo() throws Exception;
    String featuresList() throws Exception;
    String cameraList() throws Exception;
    String batteryDetailed() throws Exception;
    String locationDetailed() throws Exception;
    String localeInfo() throws Exception;

    // Patch 36
    String cpuDetail() throws Exception;
    String thermalInfo() throws Exception;
    String memoryDetail() throws Exception;
    String wifiDetailed() throws Exception;
    String bluetoothInfo() throws Exception;
    String displayBrightness() throws Exception;
    String displayColor() throws Exception;
    String microphoneList() throws Exception;
    String kernelInfo() throws Exception;

}
