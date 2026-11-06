# TipRelay Android companion

React Native 0.81.5 with a native Kotlin notification listener. Setup and diagnostics are React Native screens. Capture, encrypted credentials, SQLite storage and WorkManager uploads run in Android native code.

From the repository root, run `npm run android:apk:debug` and install the resulting `android/app/build/outputs/apk/debug/app-debug.apk` from this workspace on your phone. This is TipRelay's Expo development client and contains the native notification listener and sign-in modules.

Run `npm run dev:android` and open the project from TipRelay's development launcher or scan the terminal QR code. Keep the phone and computer on the same network. For a USB connection, run `adb reverse tcp:8081 tcp:8081` and start the server with `npm run start --workspace @tiprelay/android -- --localhost`. JavaScript changes use Fast Refresh. Rebuild the client when native code or configuration changes.

For manual phone testing, run `npm run android:apk:preview` instead. Install `android/app/build/outputs/apk/preview/app-preview.apk`. This APK bundles JavaScript, uses the development backend configuration, and opens TipRelay directly without Metro. Use the signed release APK for distribution. Run `npm run android:test` for Kotlin parser tests.

See [the Android guide](../../../docs/android-notifications.md) for SDK versions, synthetic formats, privacy limitations, physical validation and release signing.
