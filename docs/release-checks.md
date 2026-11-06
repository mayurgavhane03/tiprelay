# Release acceptance checklist

Local automated evidence is recorded separately in `verification.md`. Launch requires the following physical and deployed checks, with a dated record and recording links kept privately.

## Android and real UPI

- Build and install the signed release app on a physical Android phone. Record OS, handset, PhonePe package version, locale and battery settings.
- Configure the creator’s own UPI address and pair that phone. Grant notification access using the in-app explanation. Confirm diagnostics.
- Connect OBS, record a clip, lock the phone and put the companion UI in the background. From a consenting tester’s second device, transfer ₹1 to the creator using the supported app. Do this manually.
- Confirm the phone records a successful sync, the dashboard labels the credit as observed, and OBS shows ₹1 with a chime. Confirm settlement independently in the receiving bank/UPI app.
- Make a small outgoing payment manually and verify that no TipRelay credit event appears. Test a payment request and an unrelated notification too.
- If the real notification differs from the fixture grammar, redact it on-device and add a tested parser fixture before declaring the app supported. Never upload raw notification dumps or use real payer details in test fixtures.
- Repeat while offline then online, after process recreation, after device reboot, under normal battery restrictions, and with revoked notification access. Document gaps and observed latency.

## OBS and speech

- Play back an OBS recording and confirm the chime is audible on the configured recording track.
- Submit text using the real 12-digit reference, check the amount and message, approve it, and confirm Piper speech is audible in a second recording.
- Deliver the same normalized event twice and reconnect OBS. Confirm a single playback. Send two distinct references at the same amount and confirm two playbacks.
- Stop the speech worker, send another incoming credit and confirm the chime still plays. Restore speech after the two-minute deadline and verify that old speech never plays.
- Disconnect OBS for more than two minutes, then reconnect. Old credits should remain in history without playing.

## AWS sandbox

- Authorize the account and region, review synthesized IAM and resource changes, build the Linux Piper container, and deploy using `aws-deployment.md`.
- Test two separate Cognito users. A user must not read, approve, revoke, subscribe to or receive the other user’s records. Repeat with expired tokens and direct API requests.
- Revoke a device and rotate an OBS credential during active connections. Confirm rejected ingestion and stopped old-source delivery.
- Force an outbox retry and speech failure. Verify stable IDs, SQS retries, DLQ, alarm notifications and repair behavior.
- Load-test the expected creator count and event rate, measure cold-start/synthesis latency, and check dashboard volume bounds and AWS cost estimates.
- Exercise backup restore, credential rotation and creator deletion, including audio erasure and recovery tombstone reapplication.

## Distribution

- Run Android Gradle unit tests and release build in the configured SDK environment. Verify release signing, cleartext restrictions and manifest permissions.
- Test the installed release build, not only a debug build. Complete distribution/privacy disclosures and keep signing keys outside source control.
- Archive Piper source and license compliance materials if distributing the container. Confirm product licensing and chosen voice terms for your release package.
- Review the remaining React Native/CDK toolchain advisories recorded in `dependency-review.md` and update compatible upstream fixes before distribution where available.
- Complete English voice quality/listening checks. Do not claim Hindi or Hinglish support until evaluated.

No real transfer, physical locked-phone result, OBS recording, full cloud deployment or signing check is implied by passing synthetic tests. A backend-only development stack is deployed; CloudFront account verification and CodeBuild concurrency remain outstanding.

## Google and administrator acceptance

Follow [Google login and administration](google-login-and-admin.md). Verify Google-only login on both platforms, signed Android callback/refresh/logout, blocked dashboard access before login, default user role, unauthorized admin API denial, ban/restore/delete behavior, operator role revocation, and a real signed APK download. These are outstanding deployment and device checks.
