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
        versionCode = 1
        versionName = "0.1"
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
    implementation(files("libs/mobile.aar"))
}
