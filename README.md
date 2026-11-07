# TipRelay

Direct-UPI tip alerts for Indian livestreamers. Fans pay the creator’s own UPI address. An Android companion observes supported incoming-credit notifications, and a private OBS Browser Source displays the amount and plays a chime. Creators review matched supporter messages before Piper generates speech.

This repository contains a working local implementation and AWS deployment infrastructure. A backend-only development stack is deployed in AWS account `account`, `ap-south-1`; hosted web and speech are pending AWS account limits. It has **not been approved for public launch**. Physical Android payment capture, OBS recording and Android release signing require the checks in [the release checklist](docs/release-checks.md). Phone notifications are best-effort observations, not settlement confirmation.

## Project layout

The npm-workspaces monorepo uses Turborepo and one root lockfile. Projects are grouped as requested.

```text
TipRelay/
  docs/
  packages/
    backend/
      alert-api/
      speech-worker/
    common/
      event-contracts/
    frontend/
      tiprelay-web/
      tiprelay-android/
  infrastructure/
    aws/
  scripts/
  package.json
  package-lock.json
  turbo.json
  compose.yaml
```

| Folder                               | Project                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `packages/frontend/tiprelay-web`     | React, TypeScript and Vite dashboard, public tip page and OBS overlay               |
| `packages/frontend/tiprelay-android` | React Native Android app with Kotlin listener, SQLite queue and WorkManager uploads |
| `packages/backend/alert-api`         | Shared domain logic, local HTTP/WebSocket server and AWS Lambda handlers            |
| `packages/backend/speech-worker`     | Python Piper service and SQS container worker                                       |
| `packages/common/event-contracts`    | Zod schemas and shared TypeScript event types                                       |
| `infrastructure/aws`                 | CDK v2 application and stack                                                        |
| `scripts`                            | Development, seed, integration smoke and build commands                             |
| `docs`                               | Architecture, deployment, operations and acceptance guides                          |

## Start locally in PowerShell

Use Node 22.12+ or 24, npm 10+, and Python 3.11+ for speech. Android needs JDK 17, Android Studio SDK 36, Build Tools 36.0.0 and NDK 27.1.12297006. The dependency lockfile is at the root.

```powershell
npm ci
Copy-Item .env.example .env
npm run db:seed
npm run dev
```

`npm run dev` starts the web and API together through Turbo. Use `dev:web`, `dev:api`, `dev:android`, or `dev:speech` for an individual process. After setting up Python/Piper and Android tooling, `npm run dev:all` starts the web, API, speech worker and Android Metro server together. Installing the Android app remains a separate `npm run android --workspace @tiprelay/android` command.

Root `build`, `typecheck`, `lint` and `test` orchestrate workspace tasks through Turbo. Build outputs are cached under each workspace’s `dist`, while development servers and tests run without caching. Keep `.turbo` local and ignored.

Open [the creator dashboard](http://127.0.0.1:5173). Local mode binds the API and dashboard to loopback and seeds one creator. The default durable JSON adapter requires no AWS credentials or Docker. Run only one API process against `.local/state.json`, and stop it before reseeding.

In **Stream setup**, save your UPI details, generate an OBS URL, and add it as an OBS Browser Source. Enable **Control audio via OBS**, then press **Test alert**. The alert is delivered through the real WebSocket source. An ordinary browser may block autoplay until a user gesture.

For DynamoDB Local, start Docker and set `STORAGE=dynamo` in `.env` before seeding and starting the API.

```powershell
docker compose up -d dynamodb
npm run db:seed
npm run dev
# Separate terminal, with the local servers running
npm run smoke:alert
npm run test:dynamo
```

The smoke command rotates the local demo overlay credential and checks a fresh socket. Recreate any previously copied demo OBS URL afterward.

## Checks and builds

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run cdk -- synth --quiet
npm run android:test
```

`build` creates the web assets and bundled Lambda handlers. Android has separate Gradle build/signing steps. CDK synthesis needs the Lambda bundles. The Piper image can be built remotely in AWS after the CodeBuild quota is granted, so local Docker is optional. See [verification results](docs/verification.md) for actual checks performed here.

## Google login and administration

The public landing page is `/`. Production users sign in only with Google before opening `/dashboard`. `/admin` requires an operator-assigned admin role; all new accounts default to `user`. The Android companion uses the same Google account and checks pairing ownership. See [Google setup, admin bootstrap, and APK downloads](docs/google-login-and-admin.md).

In local development, use **Open local development demo** in the landing-page footer. This explicitly labeled demo is available only with the loopback development bypass and is excluded from production builds. Google sign-in requires external OAuth configuration, and the Android download stays disabled until a signed APK URL is configured.

## Android environment configuration

Android now reads public URLs and its Cognito client ID from root `.env.android.development.local` or `.env.android.production.local` during the native build. Signing inputs stay separate in protected shell/CI variables or ignored `.env.android.signing.local`. See [Android environment setup and APK commands](docs/android-environments.md).

## Guides

- [Architecture, isolation and data retention](docs/architecture.md)
- [Local development and Piper](docs/local-development.md)
- [Android formats, privacy and release signing](docs/android-notifications.md)
- [OBS setup and recording verification](docs/obs-setup.md)
- [AWS configuration and deployment commands](docs/aws-deployment.md)
- [Operations, cost drivers, recovery and deletion](docs/operations.md)
- [Piper engine and voice license record](docs/speech-licensing.md)
- [Outstanding release acceptance](docs/release-checks.md)
- [Local verification results](docs/verification.md)
- [Dependency advisory review](docs/dependency-review.md)

This release excludes payment custody, payouts, automatic commission, email ingestion, subscriptions and recorded viewer audio. iOS build profiles and a dashboard launcher are available; payment notification capture remains Android-only. See [iOS builds and icons](docs/ios-builds.md).
