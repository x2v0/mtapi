#!/data/data/com.termux/files/usr/bin/bash
# Termux clang -> target aarch64-linux-android26.
# -Wno-unused-command-line-argument must come AFTER any -Werror that Go passes,
# otherwise compile step fails on unused -L flags (link-only).
set -e
NDK_PRE="/data/data/com.termux/files/home/ndk/android-ndk-r29/toolchains/llvm/prebuilt/linux-aarch64"
NDK_SYS="$NDK_PRE/sysroot"
exec /data/data/com.termux/files/usr/bin/clang \
    --target=aarch64-linux-android26 \
    --sysroot="$NDK_SYS" \
    -L/data/data/com.termux/files/home/ndk/android-ndk-r29/toolchains/llvm/prebuilt/linux-aarch64/lib/clang/21/lib/linux/aarch64 -L/data/data/com.termux/files/home/ndk/android-ndk-r29/toolchains/llvm/prebuilt/linux-aarch64/sysroot/usr/lib/aarch64-linux-android -L/data/data/com.termux/files/home/ndk/android-ndk-r29/toolchains/llvm/prebuilt/linux-aarch64/sysroot/usr/lib/aarch64-linux-android/26 \
    -Wno-unused-command-line-argument \
    "$@"
