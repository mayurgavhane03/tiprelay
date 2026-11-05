# Speech image build without local Docker

`TipRelaySpeechBuildDev` creates a private S3 source bucket, an ECR repository, and a privileged CodeBuild project. The main stack consumes the worker image from ECR. Only the worker's Dockerfile, requirements, voice manifest, download script, synthesis module, and handler are uploaded. No credentials or `.env` files enter the build source.

AWS account 627551519784 currently has a zero Linux/Medium CodeBuild concurrency quota in `ap-south-1`. One build was requested under request ID `b6e813fd56394f829ae8d784397db09ckwJXRfLl`. The first development deployment therefore uses `-c skipSpeechWorker=true`. Message approval is disabled and messages remain pending. Amount and chime alerts remain available. This stage does not pass speech release acceptance.

When the quota is approved, use `.local/speech-build-outputs.json` to find the project, source bucket, and ECR repository. Rebuild the six-file ZIP, upload it as `speech-source.zip`, and start the CodeBuild project. The build downloads the pinned voice model, builds linux/amd64, and pushes the image. CodeBuild minutes, ECR storage, and image scanning add AWS costs. The S3 source expires after seven days and ECR retains up to ten images.

```powershell
$env:AWS_PROFILE='my-credentials'
$env:AWS_REGION='ap-south-1'
$env:CDK_DEFAULT_ACCOUNT='627551519784'
$env:CDK_DEFAULT_REGION='ap-south-1'
$build=(Get-Content '.local/speech-build-outputs.json' -Raw | ConvertFrom-Json).TipRelaySpeechBuildDev
$files=@('Dockerfile','requirements.txt','voice.json','download_voice.py','synthesis.py','worker.py') | ForEach-Object { Join-Path 'packages/backend/speech-worker' $_ }
Compress-Archive -LiteralPath $files -DestinationPath '.local/speech-source.zip' -Force
aws s3 cp '.local/speech-source.zip' "s3://$($build.SpeechSourceBucket)/speech-source.zip" --region ap-south-1
aws codebuild start-build --project-name $build.SpeechBuildProject --region ap-south-1
```

After the build succeeds, pin the main stack to the ECR image digest and omit the skip flag:

```powershell
$digest=aws ecr describe-images --repository-name $build.SpeechRepository --image-ids imageTag=initial --query 'imageDetails[0].imageDigest' --output text --region ap-south-1
if ($digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Speech image digest missing' }
npm run cdk -- diff TipRelayDev -c stage=development -c "speechImageDigest=$digest"
npm run cdk -- deploy TipRelayDev -c stage=development -c "speechImageDigest=$digest" --parameters GoogleClientId=YOUR_GOOGLE_WEB_CLIENT_ID --parameters GoogleSecretName=tiprelay/development/google --require-approval never --outputs-file .local/aws-outputs.json
```

For later releases, supply a new `IMAGE_TAG` CodeBuild environment variable override; tags are immutable. Use the new digest in CDK. Verify Piper speech in an OBS recording before marking the release ready.
