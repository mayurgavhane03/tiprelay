# Android observation and release

The Android project was scaffolded from React Native 0.81.5 with CLI 20.0.0. The native modules are under `android/app/src/main/java/com/tiprelaycompanion`. Metro watches the root workspace and Gradle points to root-hoisted React Native dependencies.

## Supported parser scope

`com.phonepe.app` and Google Pay (`com.google.android.apps.nbu.paisa.user`) are allowlisted. Google Pay title `Example Supporter paid you ₹100` is covered by a synthetic fixture based on a user screenshot; full on-device capture/upload is still awaiting verification. The following **synthetic English fixtures** are covered by Kotlin tests. No payment-app version, handset, Android build or live payment format has yet been certified.

| Synthetic body                                                                                  | Outcome                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------- |
| `You received ₹100.50 from Example Supporter` followed by `UPI Ref: 123456789012` on a new line | 10050 paise, reference retained |
| `Received INR 100 from Example`                                                                 | 10000 paise, no reference       |
| `Received ₹100 from Example` followed by `UTR: 123456789013`                                    | Incoming observation            |
| `You paid ₹100 to Example`                                                                      | Ignored                         |
| `Example requested ₹100`, `₹100 debited`                                                        | Ignored                         |
| Cashback, refund, failed or pending text                                                        | Ignored                         |
| Unrelated package, malformed fractional amount, excessive amount                                | Ignored                         |

The grammar also accepts `You have received`, `Rs` and `Rs.` prefixes and `UPI Reference`/`UPI Ref No`. It deliberately rejects unrecognized layouts and languages. Do not describe broad PhonePe support until the physical checklist is completed. Paytm, bank SMS and other packages are not supported.

The listener uses expanded notification text when available, ignores summary notifications, and does not upload raw title/body. It uploads a sanitized payer name (up to 80 characters) for the requested spoken announcement. It parses on-device. Event IDs derive from the notification instance identity, posting time, amount and optional reference. Updates that change the instance and provide no reference can still create a second observation. This is a documented best-effort limitation, not an amount-deduplication opportunity.

## Reliability and privacy

The service is registered with Android’s `BIND_NOTIFICATION_LISTENER_SERVICE` permission. Capture works without the React Native UI. Pairing tokens are AES-GCM encrypted with a key in Android Keystore and app backup is disabled. The SQLite queue stores only normalized events, including the payer name, keeps stable event IDs on retries and removes payloads after acknowledgement. Pending and acknowledged IDs expire locally after one day.

WorkManager requires connectivity and applies exponential retry. Reopening the app is not needed for normal upload. Android force-stop, revoked notification access, OEM battery management, offline state, locked-screen notification redaction and app notification changes can interrupt capture. Diagnostics show pairing, notification access, queued count, last successful sync and a generic last error.

Grant access only after reading the in-app disclosure. Use a dedicated creator UPI account because these notification fixtures do not identify the receiving account. Treat every event as an observed credit and check actual payment status in the bank/UPI app.

## Test and debug build

```powershell
npm run android:test
npm run android:apk:debug
```

JDK 17, SDK 36, Build Tools 36.0.0 and NDK 27.1.12297006 are required. Set `ANDROID_HOME` to your SDK and `JAVA_HOME` to JDK 17. Install the SDK with Android Studio. Gradle wrapper 8.14.3 is included. Minimum supported Android API is 26.

## Release signing and distribution

First configure [Android environment files](android-environments.md). Create a dedicated upload keystore outside the repository. Store it in your team’s secret manager and keep a tested recovery copy. Never commit keystores, passwords, `local.properties` or signing environment values. The release Gradle task fails without signing configuration and does not fall back to a debug key.

```powershell
# Obtain these values securely in your shell. Do not save them in tracked scripts.
$env:TIPRELAY_KEYSTORE='C:\secure\tiprelay-upload.jks'
$env:TIPRELAY_KEY_ALIAS='tiprelay-upload'
$env:TIPRELAY_STORE_PASSWORD=Read-Host 'Keystore password' -MaskInput
$env:TIPRELAY_KEY_PASSWORD=Read-Host 'Key password' -MaskInput
npm run android:bundle:release
Remove-Item Env:TIPRELAY_STORE_PASSWORD,Env:TIPRELAY_KEY_PASSWORD
```

Use PowerShell 7 for `-MaskInput`. The bundle is `packages/frontend/tiprelay-android/android/app/build/outputs/bundle/release/app-release.aab`. For private APK testing run `npm run android:apk:release` with the same signing environment, verify the signing certificate using `apksigner verify --print-certs`, and distribute through a controlled internal channel. For Play distribution enroll in Play App Signing, upload to internal testing, complete notification-access/privacy disclosures and test the installed release build. Verify the release manifest disallows cleartext traffic.

Record app package/version, OS build, phone model, notification locale, battery mode, redacted fixture shape, receiving UPI account, test timestamp and observed latency for each physical release test. Keep payer names and actual transaction references out of test fixtures and repository issues.

## Google session and account-owned pairing

The welcome screen explains the product before requesting Google sign-in. Configure the separate Cognito mobile client as described in [Google login setup](google-login-and-admin.md). AppAuth 8.1.0 is pinned to the React Native 0.81-compatible major. Refresh tokens and paired-device tokens use separate Android Keystore namespaces. The server requires the same creator account on the pairing code and Google access token. Sign-out disconnects the local phone and clears pending uploads. Native AppAuth compilation, callback handling, cancellation, restart refresh, account switching, and release signing are still device acceptance checks.

## Spoken payment announcements

Accepted observations and Test Alert now atomically enqueue a Piper amount announcement, independently of the chime. Payment announcements include the normalized payer name when available. Viewer-written messages still require approval. Speech jobs expire after 120 seconds and upload retries reuse the same job. Deploy both the API and rebuilt worker image; a stack deployed with `skipSpeechWorker=true` remains chime-only. See [remote speech build](remote-speech-build.md). Existing notifications are not replayed: test a new payment after installing and pairing.
