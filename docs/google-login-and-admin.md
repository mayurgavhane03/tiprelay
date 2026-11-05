# Google login and account administration

The public web route `/` explains the product. `/dashboard` resolves the authenticated account before rendering creator data. `/admin` additionally checks the server-assigned role. The public tip page and OBS source remain independent of creator browser login. Google is the only production sign-in provider. There are no password, email-code, Apple, or Facebook sign-in screens.

## Configure Google and Cognito

Complete these steps only after authorizing an AWS account and region. No deployment or external OAuth configuration has been performed by this implementation.

1. Create a Google Auth Platform project, configure its consent screen, and add test Google accounts while the app is in testing. Create a **Web application** OAuth client for Cognito federation. Web and Android share this Google provider through separate public Cognito clients.
2. Add the Google authorized redirect URI `https://tiprelay-STAGE-ACCOUNT-REGION.auth.REGION.amazoncognito.com/oauth2/idpresponse`, substituting the deployment stage, AWS account ID, and region. It must exactly match the CDK Cognito domain. Register production consent details and complete Google's publishing requirements before opening access beyond test users.
3. In AWS Secrets Manager, store the Google client secret as JSON with the key `clientSecret`. Use the AWS console so the secret is not pasted into shell history. Keep the secret in the stack's account and region. The deployment role needs permission to resolve it. Never put it in `VITE_*`, Android source, a CDK context file, or a committed environment file.
4. Deploy with the non-secret Google client ID and the secret's name. The template resolves the secret dynamically. Synthesis works without either actual value or AWS credentials.

```powershell
# Only after account/region authorization and the existing AWS deployment preparation.
npm run cdk -- deploy TipRelayDev -c stage=development `
  --parameters GoogleClientId=YOUR_GOOGLE_WEB_CLIENT_ID `
  --parameters GoogleSecretName=tiprelay/development/google `
  --outputs-file .local/aws-outputs.json
```

5. Configure web `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, and `VITE_API_URL` using stack outputs as described in `aws-deployment.md`. The web callback is `WebUrl/auth/callback` and sign-out returns to `WebUrl`. Google sign-in uses authorization code flow, state verification, and PKCE. The access token stays in tab session storage. Access tokens expire after 15 minutes; web users sign in again after expiration. Cognito sign-out clears its browser session, but does not sign the person out of Google itself.
6. Copy `.env.android.production.example` to `.env.android.production.local` at the repository root. Populate `ANDROID_API_URL`, `ANDROID_COGNITO_DOMAIN`, `ANDROID_COGNITO_CLIENT_ID`, and `ANDROID_WEB_URL` from `ApiUrl`, `CognitoDomain`, `MobileClientId`, and `WebUrl`. Keep the API URL identical to the frontend `VITE_API_URL`. Do not edit Android source. See [environment-based builds](android-environments.md). The registered callback is `com.tiprelaycompanion:/oauth2redirect`. AppAuth opens the system browser and verifies state/PKCE. Android refresh credentials are encrypted with Android Keystore in a separate namespace from device credentials. Signing out clears the session, local pairing, and queued uploads. A pairing is cleared when signing into a different account. The listener can continue independently of the login UI while paired.

Cognito self-service password registration and direct password/SRP authentication flows are disabled; both OAuth clients allow only Google. API Gateway and Lambda validate Cognito access tokens for either client. Pairing additionally verifies that the code belongs to the authenticated account. Do not manually re-enable other identity providers or password flows outside CDK.

Official references: [Cognito Google federation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp-google.html), [AppAuth configuration](https://nearform.com/open-source/react-native-app-auth/docs/usage/config/).

## Default user role and first administrator

New accounts are provisioned with `role=user`. A repeat login preserves an operator-assigned admin role. Client-supplied roles are ignored by the account endpoint and rejected by settings validation. There is no HTTP endpoint that grants admin rights.

After the intended administrator signs in once, obtain their Cognito `sub` through the AWS console. From an explicitly configured operator environment, grant their existing account the role. The script never creates an account and rejects banned/deleted profiles. AWS IAM controls who can run this operator action.

```powershell
$env:APP_ENV='production' # use development for the development stack
$env:LOCAL_AUTH_BYPASS='false'
$env:TABLE_NAME='TABLE_NAME_FROM_STACK_OUTPUT'
$env:DYNAMODB_ENDPOINT='' # prevent a .env local endpoint from being used
$env:ADMIN_CREATOR_ID='VERIFIED_COGNITO_SUB'
npm run admin:role -- --execute
# Revoke a role when needed (retain at least one operator-managed administrator).
npm run admin:role -- --execute --revoke
```

Use `/admin` after sign-in. Administrators can list account IDs, configured channel names, roles, status, and joining dates, search loaded accounts, and page through all accounts in batches of 50. This view deliberately excludes payment observations, viewer messages, UPI IDs, and device/overlay secrets. Existing profiles are indexed when they next sign in. For a deployment upgrading a populated database, have existing creators sign in to populate the index before relying on it as a complete historical directory.

- **Ban** immediately denies subsequent authenticated operations, public tip-page access, phone uploads, and overlay delivery checks. Existing overlay credentials are invalidated. Already-delivered audio/alerts cannot be recalled.
- **Restore** re-enables an account. Previously paired device credentials can resume uploads. The creator must generate a new OBS source credential.
- **Delete** permanently disables the account and clears its public name and UPI details. It is a deletion request, not a claim that retained records have already been erased. Run `data:purge` and the Cognito cleanup in the operations runbook to finish erasure. Minimal tombstones remain to prevent the same subject being silently reprovisioned.
- Administrator accounts, including the current actor, cannot be banned or deleted from this UI. Use operator tooling to revoke their role first.

Administrative writes transactionally check the actor's current role/profile version and target version. Audit events record actor ID, target ID, action, and time, with a 90-day TTL. No new access token is required for a role revocation or ban to take effect on subsequent API calls. In-flight network delivery may finish before a ban is committed.

## Local preview

`npm run dev` opens the public landing page. With the explicit loopback-only development bypass, a footer button opens the seeded demo. It is labeled as a development demo and is removed from production builds. It does not impersonate Google login. The local API still accepts the single demo identity without authentication, as required for the AWS-free vertical slice; never expose it on a shared network.

To preview administration locally, stop the local API first because its file store is single-process. Keep `.env` configured for the local demo, then run:

```powershell
$env:APP_ENV='local'
$env:LOCAL_AUTH_BYPASS='true'
$env:ADMIN_CREATOR_ID='demo'
npm run admin:role -- --execute
npm run dev
```

Open the local demo, then `/admin`. Stop the API and use `--execute --revoke` to return it to a normal user. Never use an actual creator credential for a local demo. Android Google authentication requires the provisioned Cognito environment; there is no fake native Google login.

## Android download and remaining release checks

Build and validate a signed release using the Android signing runbook. Publish the APK at an approved HTTPS release URL with the Android package MIME type, stable versioned filename, and checksum. Set `VITE_ANDROID_DOWNLOAD_URL` to that URL and rebuild/upload the web app. Until then the landing page displays a disabled download button with a release-pending explanation. No unsigned or untested APK is represented as a release.

Before launch, verify actual Google sign-in on web and Android, cancelled/expired OAuth callbacks, refresh after app restart, same-account pairing, account switching, Android browser redirect handling on a signed build, and sign-out. Test two real Google accounts and one operator-appointed admin. Confirm bans block previously issued device/socket credentials, restore requires an OBS credential rotation, and delete plus the purge runbook removes retained account data. Record these checks alongside locked-phone UPI and OBS audio acceptance; none can be inferred from unit tests or CDK synthesis.
