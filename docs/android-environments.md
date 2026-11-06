# Android environment configuration

Run commands from the repository root. No manual edits to Android TypeScript or Kotlin are needed when deployment URLs change.

## Windows setup without Android Studio

Android Studio is optional. The Android companion contains Kotlin code for notification observation, so native Android build tools are still required even though the user interface uses React Native. Install a JDK (JDK 17 is the tested version) and Google's Windows **Command line tools only** package. The SDK can live on a secondary drive, which is useful when the system drive has limited space.

The command-line tools ZIP must be laid out so that `sdkmanager.bat` is at `D:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`. If the ZIP was extracted to `D:\downloads\commandlinetools-win-...\cmdline-tools`, either move it into that layout or use that extracted parent folder as `ANDROID_HOME` in the commands below.

In Git Bash, substitute the paths for the actual JDK and SDK locations. Set `GRADLE_USER_HOME` to the secondary drive as well because Gradle downloads build dependencies.

```bash
export JAVA_HOME='C:\Program Files\Java\jdk-17'
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME='D:\Android\Sdk'
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME='D:\GradleCache'

java -version
"/d/Android/Sdk/cmdline-tools/latest/bin/sdkmanager.bat" \
  --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-36" \
  "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.31.6"
"/d/Android/Sdk/cmdline-tools/latest/bin/sdkmanager.bat" \
  --sdk_root="$ANDROID_HOME" --licenses

npm run android:apk:debug
```

The current build machine may have JDK 21 rather than 17. Set `JAVA_HOME` to its installed folder if that is all that is available; install JDK 17 if Gradle reports an unsupported Java version. The debug APK is written to `packages/frontend/tiprelay-android/android/app/build/outputs/apk/debug/app-debug.apk`. Move the repository to the secondary drive too if its `android/app/build` output would otherwise fill the system drive.

## Development

```powershell
Copy-Item .env.android.development.example .env.android.development.local
# Edit the copied file with your development CDK outputs.
npm run android:apk:debug
```

Empty development values allow UI-only debug builds. Real Google login requires the deployed development API and Cognito values. `npm run android --workspace @tiprelay/android` also reads this development file through Gradle. The local web/API demo remains independent of AWS.

## Production APK

```powershell
Copy-Item .env.android.production.example .env.android.production.local
Copy-Item .env.android.signing.example .env.android.signing.local
# Edit the two files locally. Do not paste signing passwords into chat or commit them.
npm run android:apk:release
# Optional Android App Bundle for Play distribution:
npm run android:bundle:release
```

Only copy the examples if the local files do not already exist, to avoid overwriting your configuration.

Fill the production public configuration using these stack outputs:

| Environment variable | CDK output |
| --- | --- |
| `ANDROID_API_URL` | `ApiUrl`, identical to frontend `VITE_API_URL` |
| `ANDROID_COGNITO_DOMAIN` | `CognitoDomain` |
| `ANDROID_COGNITO_CLIENT_ID` | `MobileClientId`, **not** the frontend client ID |
| `ANDROID_WEB_URL` | `WebUrl` |

These are public values and will be extractable from the APK. URLs must use HTTPS and must not contain embedded credentials, query parameters or fragments. Never place secrets in URL paths or public client IDs. All four values are required for production.

Signing configuration contains only `TIPRELAY_KEYSTORE`, `TIPRELAY_STORE_PASSWORD`, `TIPRELAY_KEY_ALIAS`, and `TIPRELAY_KEY_PASSWORD`. Keep the keystore outside the repository. An absolute path is recommended; relative paths in the build wrapper resolve from the repository root. Use single-quoted dotenv values for passwords containing spaces or `#`. Local signing files are plaintext, so protect local filesystem access; protected CI environment variables are preferred for automated releases. Neither signing passwords nor the keystore are copied into app configuration. The APK contains the public signing certificate, as Android requires.

Outputs:

- APK: `packages/frontend/tiprelay-android/android/app/build/outputs/apk/release/app-release.apk`
- Bundle: `packages/frontend/tiprelay-android/android/app/build/outputs/bundle/release/app-release.aab`

The native build still requires JDK 17, Android SDK 36, Build Tools 36.0.0, NDK 27.1.12297006 and CMake 3.31.6. See `android-notifications.md` for signing verification and distribution acceptance.

## CI and native builds

CI can supply the four `ANDROID_*` values and four signing variables directly. Process environment values take precedence over the selected file. Root build commands explicitly choose development for debug and production for release. They do not load the generic root `.env`, preventing accidental reuse of the local backend configuration.

Gradle invokes `scripts/android-config.mjs` at configuration time and embeds only its allowlisted public fields in Android `BuildConfig`. Kotlin exposes these values to React Native. Signing inputs go to Gradle's signing configuration separately. There is no generated credentials file in the JavaScript bundle and no new dotenv runtime dependency.

If invoking Gradle directly for release, set `TIPRELAY_ANDROID_STAGE=production` and provide signing variables in the process environment. The wrapper is recommended because it validates configuration and loads the optional local signing file. Direct Gradle invocations do not load that signing file. Release validation rejects development or incomplete public configuration.

Changing an Android environment file requires rebuilding and reinstalling the native app; restarting Metro alone does not update these constants. Do not distribute development-signed builds as production releases.

All `.env.*.local` files and keystores are ignored by Git. Committed `.example` files contain variable names and empty values only. Google OAuth client secrets remain in AWS Secrets Manager, and AWS credentials remain in the operator's AWS profile or CI identity.

Run `npm run test:android-config` to verify secret-field exclusion, production requirements, URL validation, and environment loading. These checks are also included in `npm test`.
