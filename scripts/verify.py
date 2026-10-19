#!/usr/bin/env python3
"""Verify repository layout matches the expected mtapi tree."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent

expected = {
    "README.md":                                              (None, None),
    ".gitignore":                                             (None, None),
    ".gitattributes":                                         (None, None),
    "Makefile":                                               ("aar", "test-go"),

    "gocore/go.mod":                                          ("module mtapi/gocore", None),
    "gocore/mobile/mobile.go":                                ("type AndroidAPI interface", "func dispatch"),
    "gocore/mobile/json_shim.go":                             ("func json_NewEncoder", None),
    "gocore/mobile/version.go":                               ('const Version = "1"', None),
    "gocore/mobile/mobile_test.go":                           ("func TestDispatch_Ping", None),
    "gocore/mobile/mobile.go":                                ("case \"contacts\":", "case \"calllog\":"),

    "client/go.mod":                                          ("module mtapi/client", None),
    "client/main.go":                                         ("func main()", "mtapi - Go client"),
    "client/pkg/client/client.go":                            ("func sockAddr()", "func (c *Client) Call"),
    "client/pkg/client/client_test.go":                       ("func TestCall_Basic", None),

    "android/settings.gradle.kts":                            ('rootProject.name = "mtapi"', None),
    "android/build.gradle.kts":                               ("com.android.application", None),
    "android/gradle.properties":                              ("android.useAndroidX=true", None),
    "android/app/build.gradle.kts":                           ('implementation(files("libs/mobile.aar"))', "androidx.camera:camera-core"),
    "android/app/src/main/AndroidManifest.xml":               ('android:foregroundServiceType="dataSync|camera"', "RECEIVE_BOOT_COMPLETED"),
    "android/app/src/main/kotlin/dev/mtapi/App.kt":           ("class App : Application", None),
    "android/app/src/main/kotlin/dev/mtapi/Token.kt":         ("SecureRandom", None),
    "android/app/src/main/kotlin/dev/mtapi/ApiService.kt":    ("LifecycleService", "Mobile.start(token"),
    "android/app/src/main/kotlin/dev/mtapi/BootReceiver.kt":  ("class BootReceiver", "ACTION_BOOT_COMPLETED"),
    "android/app/src/main/kotlin/dev/mtapi/MainActivity.kt":  ("token:\\n", None),
    "android/app/src/main/kotlin/dev/mtapi/AndroidApiImpl.kt":("ProcessCameraProvider", "override fun tts"),
    "android/app/src/main/res/values/strings.xml":            ('<string name="app_name">', None),

    "scripts/build_aar.sh":                                   ("gomobile bind", None),
    "scripts/build_apk.sh":                                   ("assembleDebug", None),
    "scripts/build_client.sh":                                ("GOOS=android", None),
    "scripts/integration.py":                                 ("def mock_server", "def run"),
    "scripts/test_boot.sh":                                   ("boot-test: OK", "TEST_BOOT"),
    "scripts/verify.py":                                      ("def main", None),
}

def main():
    missing, broken, ok = [], [], 0
    for rel, (a, b) in expected.items():
        p = ROOT / rel
        if not p.exists():
            missing.append(rel); continue
        txt = p.read_text(errors="replace")
        bad = []
        if a and a not in txt: bad.append(repr(a))
        if b and b not in txt: bad.append(repr(b))
        if bad: broken.append((rel, bad))
        else:   ok += 1

    print(f"files present & sane: {ok}/{len(expected)}")
    if missing:
        print("\nMISSING:")
        for m in missing: print("  -", m)
    if broken:
        print("\nBROKEN:")
        for rel, bad in broken: print("  -", rel, "needs", ", ".join(bad))
    return 0 if not missing and not broken else 1

if __name__ == "__main__":
    sys.exit(main())
