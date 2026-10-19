package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type check struct {
	path    string
	must    []string
	mustNot []string
}

var checks = []check{
	{path: "README.md"},
	{path: ".gitignore", must: []string{"tmp/"}},
	{path: ".gitattributes"},
	{path: "Makefile", must: []string{"grpc-e2e", "test-go", "go run ./cmd"}},

	{path: "gocore/go.mod", must: []string{"google.golang.org/grpc"}},
	{path: "gocore/mobile/mobile.go", must: []string{
		"type AndroidAPI interface", "func dispatch",
		`case "contacts":`, `case "calllog":`, `case "camera":`,
	}},
	{path: "gocore/mobile/version.go", must: []string{`const Version = "1"`}},
	{path: "gocore/mobile/mobile_test.go", must: []string{
		"func TestDispatch_Ping", "TestDispatchResponse_JSONFormat",
	}},
	{path: "gocore/mobile/grpc.go", must: []string{"newGRPCServer", "startGRPC"}},
	{path: "gocore/mobile/grpc_codec.go", must: []string{"type jsonCodec"}},
	{path: "gocore/mobile/grpc_test.go", must: []string{"TestGRPC_UnaryPing"}},

	{path: "client/go.mod", must: []string{"google.golang.org/grpc"}},
	{path: "client/main.go", must: []string{"func main()", "mtapi - Go client", "MTAPI_PROTO"}},
	{path: "client/pkg/client/client.go", must: []string{"func sockAddr()", "func (c *Client) Call"}},
	{path: "client/pkg/client/client_test.go", must: []string{"func TestCall_Basic"}},
	{path: "client/pkg/client/grpc.go", must: []string{"func NewGRPC", "func (c *GRPCClient) Ticker"}},
	{path: "client/pkg/client/grpc_codec.go", must: []string{"type jsonCodec"}},
	{path: "client/pkg/client/grpc_test.go", must: []string{"TestGRPCClient_Ticker"}},

	{path: "android/settings.gradle.kts", must: []string{`rootProject.name = "mtapi"`}},
	{path: "android/build.gradle.kts", must: []string{"com.android.application"}},
	{path: "android/gradle.properties", must: []string{"android.useAndroidX=true"}},
	{path: "android/app/build.gradle.kts", must: []string{
		`implementation(files("libs/mobile.aar"))`,
	}},
	{path: "android/app/src/main/AndroidManifest.xml", must: []string{
		`android:foregroundServiceType="dataSync"`, "RECEIVE_BOOT_COMPLETED",
	}},
	{path: "android/app/src/main/java/dev/mtapi/App.java", must: []string{"class App extends Application"}},
	{path: "android/app/src/main/java/dev/mtapi/Token.java", must: []string{"SecureRandom"}},
	{path: "android/app/src/main/java/dev/mtapi/ApiService.java", must: []string{
		"class ApiService extends Service", "Mobile.start(token",
	}},
	{path: "android/app/src/main/java/dev/mtapi/MainActivity.java", must: []string{`token:\n`}},
	{path: "android/app/src/main/java/dev/mtapi/AndroidApiImpl.java", must: []string{
		"class AndroidApiImpl", "public void tts",
	}},
	{path: "android/app/src/main/java/dev/mtapi/BootReceiver.java", must: []string{
		"class BootReceiver", "ACTION_BOOT_COMPLETED",
	}},
	{path: "android/app/src/main/res/values/strings.xml", must: []string{`<string name="app_name">`}},

	{path: "scripts/build_aar.sh", must: []string{"gomobile bind"}},
	{path: "scripts/build_apk.sh", must: []string{"assembleDebug"}},
	{path: "scripts/build_client.sh", must: []string{"GOOS=android", "GOARCH=arm64", "mtapi-linux-amd64"}},
	{path: "scripts/test_boot.sh", must: []string{"boot-test: OK", "TEST_BOOT"}},

	{path: "tools/go.mod", must: []string{"module mtapi/tools"}},
	{path: "tools/cmd/verify/main.go", must: []string{"func main"}},
	{path: "tools/cmd/integration/main.go", must: []string{"func mockServer"}},
	{path: "tools/cmd/grpce2e/main.go", must: []string{"func buildServer"}},
}

func findRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "client", "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func main() {
	root := findRoot()
	if root == "" {
		fmt.Fprintln(os.Stderr, "repo root not found (need client/go.mod above cwd)")
		os.Exit(1)
	}

	missing := []string{}
	broken := [][2]string{}
	ok := 0

	for _, c := range checks {
		b, err := os.ReadFile(filepath.Join(root, c.path))
		if err != nil {
			missing = append(missing, c.path)
			continue
		}
		txt := string(b)
		bad := ""
		for _, m := range c.must {
			if !strings.Contains(txt, m) {
				bad = fmt.Sprintf("missing %q", m)
				break
			}
		}
		if bad == "" {
			for _, m := range c.mustNot {
				if strings.Contains(txt, m) {
					bad = fmt.Sprintf("contains forbidden %q", m)
					break
				}
			}
		}
		if bad != "" {
			broken = append(broken, [2]string{c.path, bad})
		} else {
			ok++
		}
	}

	fmt.Printf("files present & sane: %d/%d\n", ok, len(checks))
	if len(missing) > 0 {
		fmt.Println("\nMISSING:")
		for _, m := range missing {
			fmt.Println("  -", m)
		}
	}
	if len(broken) > 0 {
		fmt.Println("\nBROKEN:")
		for _, b := range broken {
			fmt.Printf("  - %s %s\n", b[0], b[1])
		}
	}
	if len(missing) > 0 || len(broken) > 0 {
		os.Exit(1)
	}
}
