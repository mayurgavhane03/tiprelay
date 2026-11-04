# Operations and recovery

## Signals and triage

Connect an operator to the synthesized SNS alarm topic. Inspect API 5xx, Lambda errors, outbox age, SQS oldest message age, speech failures and DLQ count. Log fields include correlation IDs, status and synthesis duration, never request bodies or credentials. Do not enable unrestricted SDK debug logging.

If alerts stop, check the creator’s active socket count, overlay generation, device pairing, phone notification access, last sync and queued uploads. Confirm a Test Alert first, then verify the actual UPI app independently. Never infer settlement from an alert or its absence.

If the outbox is stale, inspect Lambda errors and DynamoDB throttles. The scheduled repair pass reprocesses pending GSI rows. IDs remain stable, so retries are safe for active overlays. After two minutes, old alerts are discarded for playback while the observation remains in history. Repair scans no global table data.

If speech fails, check the worker logs, model checksum/build, memory, duration, SQS age and DLQ. Amount/chime delivery continues. Correct the worker and redrive the DLQ only after verifying job expiry. The worker drops expired jobs, so old speech cannot unexpectedly replay. Do not edit a pending job’s deadline to force old text on stream. Ask the creator to approve new content intentionally.

## Recovery and rollback

DynamoDB PITR is enabled. Restore into a new table, inspect recovered state, and update the stack/function table mapping through a reviewed deployment. Do not replay old outboxes blindly. Expiry gates protect OBS, but inspect restored device revocations, deletion tombstones and overlay generations before reopening traffic. Retain a separate operational record of revoked accounts and deletion requests so a restore can reapply them.

Keep the previous web build and stack asset manifest. Roll back the web by uploading the earlier `index.html` and matching hashed assets, then invalidate CloudFront. The web bucket is versioned with 30-day noncurrent-object retention. Roll back Lambda/CDK by deploying the previous reviewed commit and image asset. Preserve schema compatibility until the previous version can no longer be required. This initial release has additive rows and versioned conditional writes, with no destructive migrations.

For a suspected credential leak, revoke the affected phone from Stream setup or rotate the overlay URL. Rotation disables old subscriptions at publication and replay. Replace the Browser Source URL in OBS, verify Test Alert, then pair a fresh phone if needed. Never reuse an exposed code or token. Cognito access tokens expire in 30 minutes; revoke user sessions through Cognito and disable the user for an account compromise.

## Creator deletion

`DELETE /v1/dashboard/account` immediately writes a creator deletion tombstone, clears public payment details and increments the overlay generation. All device, public, socket and speech paths check the tombstone. This is logical deletion, followed by operational erasure.

Run the supplied purge script against the explicitly selected table only after the creator has requested deletion and the tombstone exists. It removes the tenant’s rows and global credential/slug/connection lookup rows while retaining a minimal tombstone to prevent reactivation. The script uses paginated scans for this exceptional administrative operation, never for alert delivery.

```powershell
# After authorization for this specific deletion and AWS target
$env:TABLE_NAME='TABLE_FROM_APPROVED_STACK'
$env:AUDIO_BUCKET='AUDIO_BUCKET_FROM_APPROVED_STACK'
$env:DELETE_CREATOR_ID='COGNITO_SUB_FROM_REQUEST'
npm run data:purge -- --execute
```

The audio prefix is the SHA-256 of the creator ID. The script removes those objects. Delete the Cognito user through your operator workflow after verifying the request. Remove outstanding SQS/DLQ entries only by supported redrive/expiry procedures, since jobs contain IDs and are blocked by the tombstone. Audio lifecycle provides a one-day upper bound for temporary orphan objects. Live signed audio links expire within 60 seconds. Explain backup retention and any applicable hold before promising an erasure date. PITR retains prior state for up to its configured recovery window, so reapply tombstones after a restore.

## Cost drivers and quotas

Primary costs scale with API requests, Lambda duration/memory, WebSocket connection-minutes/messages, DynamoDB transactions/reads/streams/backups, SQS retries, speech compute, S3 audio requests/bytes, CloudFront delivery and CloudWatch log volume. Piper has no per-message vendor charge. The speech Lambda reserves four concurrent executions to bound compute pressure, and queue age alarms expose overload. The repair timer runs every minute even when idle.

Set AWS Budgets for the approved account and stage, configure a recipient, and load-test expected creator/fan volumes before selecting service limits. The seven-day dashboard query must be assessed for high-volume creators. Add pagination before onboarding traffic that exceeds the measured bound. Keep abuse rate limits, payload caps, API throttles and model/text limits enabled. Actual costs depend on region and traffic; no fixed monthly quote is claimed.

The serverless backend avoids an always-running application server. Lambda charges depend on requests and execution duration, while API Gateway HTTP and WebSocket charges depend on usage, including socket connection time. The resulting savings depend on the workload. Consult [Lambda pricing](https://aws.amazon.com/lambda/pricing/) and [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/) for the approved region.
