# Verification record

Local work was verified on Windows on 4 November 2026. This record distinguishes executable tests from hardware and cloud acceptance.

## Built

- npm-workspaces monorepo with one lockfile and Turborepo, grouped under `packages/backend`, `packages/common` and `packages/frontend`.
- React dashboard, setup wizard, public UPI page and private WebSocket overlay with a bundled chime and independent speech queue.
- TypeScript application logic with local HTTP/WebSocket adapters, atomic DynamoDB persistence/outbox, revocable pairing credentials, ticket exchange, moderation and tenant checks.
- React Native Android project with native Kotlin listener, allowlisted parser, encrypted credentials, SQLite queue, WorkManager retry, setup and diagnostics.
- Pinned Piper Python worker, immutable model revision/checksums, asynchronous SQS handler and signed audio delivery.
- CDK development/production stacks, Cognito access-token checks, CI workflow, PowerShell setup and operations/recovery/deletion guides.

## Passed locally

| Check                   | Evidence                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root Turbo development  | `npm run dev` starts web/API; `npm run dev:all` starts web/API/Piper/Metro on loopback                                                                |
| TypeScript              | Workspace type checks and root script types                                                                                                           |
| ESLint                  | Workspace and root script checks                                                                                                                      |
| Application tests       | 35 passing tests covering isolation, revocation, retries, equal amounts, matching, speech failure and expiry                                          |
| Kotlin parser           | Four actual `CreditParserTest` JUnit tests compiled/run with Kotlin 2.1.20 and JUnit 4.13.2 outside Android Gradle                                    |
| Python tests            | Two tests for text limits and retriable worker failures                                                                                               |
| React Native JavaScript | Metro produced the Android production JS bundle                                                                                                       |
| Web and API build       | Vite production assets and three bundled Node Lambda handlers                                                                                         |
| CDK synth               | Both `TipRelayDev` and `TipRelayProd` CloudFormation templates generated                                                                              |
| DynamoDB Local          | Real conditional transactions, concurrent duplicate ingestion, distinct equal-value references and observation/outbox atomic writes                   |
| Alert smoke             | Actual ticket exchange and WebSocket receipt of Test Alert; chime asset served                                                                        |
| Speech smoke            | Synthetic ₹1 observation, duplicate retry, approved matching text, real Piper WAV, socket speech event, signed audio fetch and unsigned-access denial |
| Browser preview         | Dashboard rendered and displayed the synthetic local observation                                                                                      |

The synthetic speech smoke leaves demo history and a revoked temporary device, and rotates the demo overlay credential. Its ₹1 observation is synthetic and represents no real transfer. The English voice generated a nonempty RIFF/WAV locally. Audibility in OBS is still a physical acceptance check.

The SDK-free Kotlin test run uses the exact repository parser and test source with the Gradle-downloaded compiler, official JUnit and Hamcrest jars. It does not compile the notification service or prove Android background execution. The normal reproducible Android test command remains `npm run android:test` in a configured SDK environment.

## Outstanding launch checks

- Android native Gradle test/build stopped at **SDK location not found**. Install/configure SDK 36, Build Tools 36.0.0 and NDK 27.1.12297006, then run the Android commands in `android-notifications.md`. No physical handset was available.
- No real UPI transfer or locked-phone delivery has been performed. No live PhonePe version is certified. Only the documented synthetic English grammar has passed parser tests.
- No OBS recording was made, so mixer routing and audible chime/Piper output remain unverified.
- Docker is unavailable. The Linux worker image has not been built or run here. The local Python runtime and voice have been exercised.
- AWS account/region authorization has not been supplied. No AWS resources were deployed. Deployed Cognito, IAM, sockets, SQS, alarms, load and recovery tests remain required.
- Android signing credentials were not supplied or created. Release signing and distribution remain pending.
- The high-severity Zod advisory was addressed by updating to 4.6.7. Remaining inherited tooling advisories and release artifact inventories are tracked in `dependency-review.md`.

Use `release-checks.md` for the exact acceptance procedure. These limits prevent declaring the product launch-ready.

## Google login and administration increment

Added public product landing, Google-only Cognito OAuth clients, web PKCE and route gates, Android AppAuth welcome/login with Keystore refresh storage, account-owned pairing, server-side roles, paged admin directory, ban/restore/deletion requests, and operator-only role bootstrap. Thirteen additional automated tests passed for roles, escalation denial, revoked access through bans, ownership, audit, deletion tombstones, and pagination, including OAuth state/PKCE/callback-reuse checks, pending-alert suppression, and concurrent administrator-role revocation. Web/API builds, TypeScript, ESLint, and Metro Android production JavaScript bundling passed. Browser checks confirmed the public landing, missing-Google-configuration message, dashboard login gate, local demo, and denial of the admin page to a normal user.

Real Google OAuth has not been executed because the external Google/Cognito deployment is not configured or authorized. Native AppAuth integration still needs Android SDK compilation and signed-device callback testing. The APK download remains intentionally disabled until a validated signed release URL is provided. No AWS resources were deployed.

The updated CDK template also passed `node scripts/check-auth-stack.mjs`, which asserts Google-only authorization-code clients, disabled password/SRP flows, separate mobile client, and JWT-protected account, admin, dashboard and pairing routes. Python tests (2) and the actual local WebSocket/chime-asset smoke passed again after the account changes.

## Android environment build setup — 5 November 2026

Android public configuration now comes from stage-specific ignored environment files or CI variables, with four allowlisted values exposed through native BuildConfig. Private signing inputs are loaded separately by the root APK/AAB build wrappers. Four configuration tests verify field exclusion, required production fields, URL validation, and CI loading. Git ignore checks confirmed that development, production, and signing local files are excluded. ESLint and TypeScript checks passed. Native APK validation still requires the Android SDK and signed-device release checks. See `android-environments.md`.
