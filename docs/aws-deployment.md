# AWS deployment

No AWS deployment is authorized yet. Obtain explicit approval for the target account and region before bootstrap, deploy, image publication or web upload. The default suggested region is `ap-south-1`. Confirm organizational policies, quotas, service availability and the current prices in that account before provisioning.

## Synthesized resources

Each stage has Cognito, a private web bucket and CloudFront distribution with origin access control, HTTP and WebSocket APIs, Node Lambda handlers, an encrypted on-demand DynamoDB table with streams/PITR/TTL, speech SQS and DLQ, a Piper image Lambda, private audio S3 with lifecycle expiry, bounded CloudWatch logs, alarms and an SNS alarm topic. Production additionally enables table deletion protection. Retained buckets, table, user pool and logs survive stack deletion.

The Lambda roles have table, queue, bucket and connection permissions scoped to provisioned resources. There are no embedded AWS credentials. CloudFront enforces HTTPS and security headers. API Gateway uses TLS and throttles requests. HTTP dashboard routes require Cognito and the Lambda verifies access-token semantics again.

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
docker build -t tiprelay-speech:release packages/backend/speech-worker
```

Synthesis packages a Docker asset definition but does not build or publish it. Validate the image on Linux and benchmark cold starts before deployment. Inspect `cdk.out/TipRelayDev.template.json` or the production template. A public custom domain is optional and has not been configured.

## After account and region authorization

```powershell
$env:AWS_PROFILE='your-approved-profile'
$env:AWS_REGION='ap-south-1'
aws sts get-caller-identity
$env:CDK_DEFAULT_ACCOUNT='YOUR_APPROVED_12_DIGIT_ACCOUNT'
$env:CDK_DEFAULT_REGION=$env:AWS_REGION
npm run cdk -- bootstrap "aws://$env:CDK_DEFAULT_ACCOUNT/$env:AWS_REGION"
npm run cdk -- diff TipRelayDev -c stage=development
npm run cdk -- deploy TipRelayDev -c stage=development --outputs-file .local/aws-outputs.json
```

Review diff/IAM changes and deployment output. CDK builds and publishes the speech container during deployment. Use the production stage only after the sandbox acceptance checklist passes.

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

Create two Cognito test creators, configure UPI details separately, pair independent phones and open separate OBS sources. Verify cross-creator access and stream isolation, token expiration, device revocation, URL rotation, duplicated deliveries, disconnected replay expiry, speech failure and deletion. Keep production onboarding disabled operationally until this checklist is signed off. Public Cognito signup is enabled in the template, so deploy only to an authorized private testing environment first.
