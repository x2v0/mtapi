# w2a / WTA capabilities (auto-generated)

```
### WTA config struct fields ###

--- config.go ---
  Config: App, Type, Web, HTML, Frontend, NodeJS, Go, Python, Gallery, Image, Video, MultiWeb, Permissions, Locales, Features, Template, Splash, Sign, Output, BaseDir
  AppSection: Name, Package, VersionCode, VersionName, Icon, Engine, Language
  WebSection: URL, UserAgent, JavaScriptEnabled, DomStorageEnabled, AllowFileAccess, AllowContentAccess, CacheEnabled, ClearBrowsingDataOnLaunch, ZoomEnabled, DesktopMode, SwipeRefreshEnabled, OverscrollEffectEnabled, HideToolbar, BrowserToolbarEnabled, UserAgentMode, CustomUserAgent, OrientationMode, KeyboardAdjustMode, InitialScale, PageZoomPercent, ViewportMode, NewWindowBehavior, EnablePaymentSchemes, EnableShareBridge, MediaAutoplayEnabled, AcceptThirdPartyCookies, JavaScriptCanOpenWindows, ThemeType, DarkMode, Engine, InjectCss, InjectJs, ExternalLinks, HideStatusBar
  HTMLSection: Source, EntryFile
  FrontendSection: Source
  NodeJSSection: Source, EntryModule, Port, NodeVersion, ABIs, EnvVars
  GoSection: Source, ABIs, NoCGO
  PythonSection: Source, EntryModule
  GallerySection: Source, Columns
  ImageSection: Source, AspectRatio
  VideoSection: Source, Autoplay
  MultiWebSection: Sites
  SiteEntry: Name, URL, Icon
  PermissionsSection: Add, Remove
  LocalesSection: Keep, StripLocales, StripScripts
  FeaturesSection: Stacks, GoRuntime
  TemplateSection: APK, StripShellLocales
  SignSection: Enabled, Keystore, KsPass, KeyAlias, KeyPass, V1, V2, V3, V4, MinSDK
  SplashSection: Enabled, Color, Duration
  OutputSection: Path, Align, Cache

--- load.go ---

### WTA commands ###

### examples-wta/04-go.yaml (206 chars, first 1500) ###
app:
  name: "Example Go Server"
  package: com.example.goserver
  versionCode: 1
  versionName: "1.0.0"
type: go
go:
  source: ./goproject
  abis: [arm64-v8a]
  noCgo: true
output:
  path: build/04-go.apk


### examples-wta/10-full-featured.yaml (526 chars, first 1500) ###
# 10 — Wikipedia + permissions + locales + 16KB alignment

app:
  name: "Wikipedia Full"
  package: com.example.wikifull
  versionCode: 1
  versionName: "1.0.0"
  engine: webview

type: web

web:
  url: https://ru.wikipedia.org
  userAgent: "WikiApp/1.0 (Android)"

permissions:
  add:
    - com.google.android.gms.permission.AD_ID
    - android.permission.ACCESS_ADSERVICES_AD_ID
  remove:
    - android.permission.QUERY_ALL_PACKAGES

locales:
  keep: [en, ru]

output:
  path: build/10-full.apk
  align: 16384
  cache: true


### examples-wta/09-with-permissions.yaml (383 chars, first 1500) ###
# 09 — Permissions add/remove с Wikipedia

app:
  name: "Wikipedia + Permissions"
  package: com.example.wikiperm
  versionCode: 1
  versionName: "1.0.0"

type: web

web:
  url: https://ru.wikipedia.org

permissions:
  add:
    - android.permission.CAMERA
    - android.permission.RECORD_AUDIO
  remove:
    - android.permission.QUERY_ALL_PACKAGES

output:
  path: build/09-perm.apk


### aar.go — what WTA does with AARs ###
  func ExtractClassesJar
  func FindNewestBuildTool
  func compareVersion
  func atoiSafe
  func HostExeSuffix
  func HostBatSuffix
  uses: classes.jar

### d8.go — how dex compilation is done ###
  // D8Options holds the parameters needed to invoke d8.
  D8Binary  string // absolute path to d8 / d8.bat
  AndroidJar string // absolute path to android.jar
  InputJars []string // input jar files
  func RunD8(opts D8Options) error {
  return fmt.Errorf("d8 binary not found: %s", opts.D8Binary)
  return fmt.Errorf("android.jar not found: %s", opts.AndroidJar)
  cmd := exec.Command(opts.D8Binary, args...)

### axml.go — manifest elements WTA can patch ###

### orchestrator.go — stage comments ###
  // 1. Resolve template.
  // 2. Load target.
  // 3. Let target prepare an APK (may be a no-op for WEB/HTML).
  // 4. Apply common modifications.
  // 5. Move stage1 to output.

### shells/ (template APKs) ###
  go-headless/: []
  go-webview/: ['AndroidManifest.xml', 'build.sh', 'template.apk', 'template.apk.idsig']
  go-webview-jni/: []
```
