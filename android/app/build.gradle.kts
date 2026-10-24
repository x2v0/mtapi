plugins {
    id("com.android.application")
}

android {
    namespace = "dev.mtapi"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.mtapi"
        minSdk = 26
        targetSdk = 34
        versionCode = 220
        versionName = "2.2.0"
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module")
    }
}

dependencies {
    implementation("androidx.core:core:1.12.0")
    // mobile.aar removed — libmtapi-server.so ships via jniLibs/arm64-v8a/
}
