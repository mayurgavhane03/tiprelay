# AWS deployment

The development target is AWS account `627551519784` in `ap-south-1`, using the `my-credentials` profile. CDK bootstrap and the speech build support stack have been deployed. The full application stack was blocked by CloudFront account verification; see the staged deployment below. Production deployment needs separate authorization.

## Synthesized resources

Each stage has Cognito, a private web bucket and CloudFront distribution with origin access control, HTTP and WebSocket APIs, Node Lambda handlers, an encrypted on-demand DynamoDB table with streams/PITR/TTL, speech SQS and DLQ, a Piper image Lambda, private audio S3 with lifecycle expiry, bounded CloudWatch logs, alarms and an SNS alarm topic. Production additionally enables table deletion protection. Retained buckets, table, user pool and logs survive stack deletion.

The Lambda roles have table, queue, bucket and connection permissions scoped to provisioned resources. There are no embedded AWS credentials. CloudFront enforces HTTPS and security headers. API Gateway uses TLS and throttles requests. HTTP dashboard, account, admin, and device-pairing routes require Cognito and the Lambda verifies access-token semantics again.

WebSocket ticket validation happens in the `$connect` Lambda. `ready` and publication revalidate tenant and overlay version. API access logging is omitted deliberately to avoid recording bearer credentials or query tickets. Application logging is structured and redacted. Configure an additional access-log sink only with an explicit allowlist of status, route key, request ID and latency fields.

## Prepare without provisioning

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run cdk -- synth --quiet -c stage=development
npm run cdk -- synth --quiet -c stage=production
```

The Piper image is built remotely with CodeBuild and stored in private ECR. See [remote speech build](remote-speech-build.md). Synthesis does not build or publish the image. Validate Linux behavior and cold starts before production. Inspect `cdk.out/TipRelayDev.template.json` or the production template. A public custom domain is optional and has not been configured.

## After account and region authorization

```powershell
$env:AWS_PROFILE='your-approved-profile'
$env:AWS_REGION='ap-south-1'
aws sts get-caller-identity
$env:CDK_DEFAULT_ACCOUNT='YOUR_APPROVED_12_DIGIT_ACCOUNT'
$env:CDK_DEFAULT_REGION=$env:AWS_REGION
npm run cdk -- bootstrap "aws://$env:CDK_DEFAULT_ACCOUNT/$env:AWS_REGION"
npm run cdk -- diff TipRelayDev -c stage=development
npm run cdk -- deploy TipRelayDev -c stage=development --parameters GoogleClientId=YOUR_GOOGLE_WEB_CLIENT_ID --parameters GoogleSecretName=tiprelay/development/google --outputs-file .local/aws-outputs.json
```

First complete [Google provider and secret configuration](google-login-and-admin.md). Review diff/IAM changes and deployment output. Deploy the speech build stack and publish its image before enabling the speech worker. Development may temporarily use `-c skipSpeechWorker=true`, which disables speech approval while preserving amount and chime alerts. Use the production stage only after the sandbox acceptance checklist passes.

## Backend-only development stage

AWS denied CloudFront creation because this account needs verification by AWS Support. Until that is resolved, use `-c skipCloudFront=true -c skipSpeechWorker=true` for `TipRelayDev`. This creates the API, WebSocket API, Cognito, and durable backend resources, while Cognito redirects the web client to `http://localhost:5173/auth/callback`. The development web bucket remains private and is not a hosted site. Do not use this stage for release. When CloudFront access and the CodeBuild quota are granted, remove both skip flags and deploy the full stack.

Open AWS Support Center in account `627551519784` and request CloudFront account verification. Include the CloudFormation error: “Your account must be verified before you can add new CloudFront resources.” The CodeBuild Linux/Medium concurrency request is tracked separately under `b6e813fd56394f829ae8d784397db09ckwJXRfLl`; its status was `CASE_OPENED` on 2026-11-05. Neither restriction is resolved by adding local credentials or installing Docker.

```powershell
$env:AWS_PROFILE='my-credentials'
$env:AWS_REGION='ap-south-1'
$env:CDK_DEFAULT_ACCOUNT='627551519784'
$env:CDK_DEFAULT_REGION='ap-south-1'
npm run cdk -- deploy TipRelayDev -c stage=development -c skipCloudFront=true -c skipSpeechWorker=true --parameters GoogleClientId=YOUR_GOOGLE_WEB_CLIENT_ID --parameters GoogleSecretName=tiprelay/development/google --require-approval never --outputs-file .local/aws-outputs.json
$outputs=(Get-Content .local/aws-outputs.json -Raw | ConvertFrom-Json).TipRelayDev
$env:VITE_API_URL=$outputs.ApiUrl
$env:VITE_WS_URL=$outputs.SocketUrl
$env:VITE_COGNITO_DOMAIN=$outputs.CognitoDomain
$env:VITE_COGNITO_CLIENT_ID=$outputs.ClientId
$env:VITE_LOCAL_MODE='false'
npm run dev:web
```

Open `http://localhost:5173`. Google sign-in is then handled by the deployed Cognito pool. The `VITE_*` values are public identifiers and endpoints; do not put the Google secret or AWS credentials in them.

## Configure and upload the web app

Use stack outputs to create `.env.production.local` at repository root. These are public configuration identifiers. The OBS and device credentials must never enter this file or any `VITE_*` value.

```powershell
$outputs=(Get-Content .local/aws-outputs.json -Raw | ConvertFrom-Json).TipRelayDev
@"
VITE_API_URL=$($outputs.ApiUrl)
VITE_WS_URL=$($outputs.SocketUrl)
VITE_COGNITO_DOMAIN=$($outputs.CognitoDomain)
VITE_COGNITO_CLIENT_ID=$($outputs.ClientId)
VITE_LOCAL_MODE=false
"@ | Set-Content .env.production.local
npm run build
aws s3 sync packages/frontend/tiprelay-web/dist "s3://$($outputs.WebBucket)" --exclude index.html --cache-control 'public,max-age=31536000,immutable'
aws s3 cp packages/frontend/tiprelay-web/dist/index.html "s3://$($outputs.WebBucket)/index.html" --cache-control 'no-cache' --content-type 'text/html'
aws cloudfront create-invalidation --distribution-id $outputs.DistributionId --paths /index.html /
```

The upload is an explicit release step, enabling review of the built configuration before publication. The Cognito callback uses the generated CloudFront origin at `/auth/callback`. If using a custom domain, update both CloudFront certificate/aliases and Cognito callback/logout URLs together.

Subscribe an operational destination to the SNS topic output and confirm the subscription. Alarms without an attached receiver do not notify an operator. Verify API 5xx, Lambda errors, outbox age, speech queue age and DLQ alarms in the sandbox. CloudWatch logs expire after two weeks.

## Post-deploy checks

Sign in with two Google test accounts, configure UPI details separately, pair independent phones and open separate OBS sources. Verify cross-creator access and stream isolation, token expiration, device revocation, URL rotation, duplicated deliveries, disconnected replay expiry, speech failure and deletion. Keep production onboarding disabled operationally until this checklist is signed off. Cognito password signup is disabled. Keep the Google consent screen in testing with an explicit test-user list until acceptance is complete.

## Root package scripts

Commands use the current AWS profile/account/region. Synth, diff and application deployment build Lambda bundles first. Append CDK flags after `--`.

| Command | Purpose |
| --- | --- |
| `npm run backend:build` | Bundle backend handlers |
| `npm run backend:test` | Backend tests |
| `npm run cdk:bootstrap -- aws://ACCOUNT/REGION` | Bootstrap target |
| `npm run cdk:list` | List stacks |
| `npm run cdk:synth -- -c stage=development` | Build and synthesize |
| `npm run cdk:diff -- TipRelayDev -c stage=development` | Review changes |
| `npm run cdk:deploy:dev` | Deploy development application |
| `npm run cdk:deploy:prod` | Deploy production application |
| `npm run cdk:deploy:speech:dev` | Deploy development speech build infrastructure |
| `npm run cdk:deploy:speech:prod` | Deploy production speech build infrastructure |
| `npm run cdk:deploy -- STACK -c stage=development` | Generic deployment |

Application deploys require Google parameters, e.g. `npm run cdk:deploy:dev -- --parameters GoogleClientId=YOUR_ID --parameters GoogleSecretName=tiprelay/development/google -c speechImageDigest=sha256:YOUR_DIGEST`. See the remote speech build guide for publishing the image and obtaining its digest. Speech infrastructure deployment alone does not publish an image. Use `-c skipCloudFront=true` for backend development while hosting is unavailable. CDK IAM approval prompts remain enabled.
