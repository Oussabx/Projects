# Zombie Rush for Android

`dist/zombie-rush.apk` is the game packaged as an Android app: a full-screen WebView that runs the `zombie-rush/` web game from inside the APK. It works offline.

- Package: `com.zombierush.game` · Android 7.0+ (minSdk 24, targetSdk 34) · signed with APK Signature Scheme v2

## Install on a phone

1. Send `zombie-rush.apk` to the phone (message, email, Drive, USB…).
2. Tap it. Android asks to allow installs from that app (for example Files or Chrome); allow it.
3. Tap **Install**. Play Protect may warn about an unknown developer: choose **Install anyway**.

## Rebuild after changing the game

```sh
python3 build_apk.py
```

Needs a JDK and Python 3 (plus Playwright/Chromium to render the icon; set `CHROMIUM_PATH` if needed). It downloads `dalvik-dx`, `apksig` and the Android API stubs from Maven Central, writes the binary manifest and resource table itself, and signs the APK. No Android SDK or Gradle required.

Bump `VERSION_CODE` in `build_apk.py` for each release so phones accept the update.

## Signing key

`zombie-rush-test.p12` (alias and password `zombierush`) is a **test key** kept here so every build is signed the same way; Android only installs an update over an existing install when the key matches. Before publishing to Google Play, create a private key and do not commit it.
