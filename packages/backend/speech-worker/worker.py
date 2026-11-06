"""SQS Lambda handler. Read approved content from durable storage, never from SQS."""
import hashlib
import json
import os
import time
import boto3
from boto3.dynamodb.types import TypeSerializer
from synthesis import synthesize

_serializer = TypeSerializer()


def encoded(row):
    return {key: _serializer.serialize(value) for key, value in row.items()}


def process(creator_id, job_id):
    table_name = os.environ["TABLE_NAME"]
    table = boto3.resource("dynamodb").Table(table_name)
    pk = f"CREATOR#{creator_id}"
    job = table.get_item(Key={"pk": pk, "sk": f"JOB#{job_id}"}, ConsistentRead=True).get("Item")
    if not job or job["status"] == "ready":
        return
    now = int(time.time())
    if job["expiresAt"] <= now:
        table.update_item(Key={"pk": pk, "sk": job["sk"]}, UpdateExpression="SET #s=:expired", ConditionExpression="#s <> :ready", ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":expired": "expired", ":ready": "ready"})
        return
    profile = table.get_item(Key={"pk": pk, "sk": "PROFILE"}, ConsistentRead=True).get("Item")
    if not profile or profile.get("deleted") or profile.get("banned"):
        return
    if job.get("kind") == "amount":
        source = table.get_item(Key={"pk": pk, "sk": f"ALERT#{job['sourceAlertId']}"}, ConsistentRead=True).get("Item")
        if not source or source["alert"]["kind"] not in ("credit", "test"):
            return
        amount = int(source["alert"]["amountPaise"])
        name = job.get("payerName", "")
        if not isinstance(name, str) or len(name) > 80 or any(not (c.isalnum() or c in " '-") for c in name):
            return
        suffix = f" from {name}" if name else ""
        spoken_amount = f"{amount // 100} rupees"
        if amount % 100:
            spoken_amount += f" and {amount % 100} paise"
        text = f"{spoken_amount} received{suffix}. Thank you for your support."
        if source["alert"]["kind"] == "test":
            text = "Test alert. " + text
        content_check = {"ConditionCheck": {"TableName": table_name, "Key": encoded({"pk": pk, "sk": source["sk"]}), "ConditionExpression": "attribute_exists(pk)"}}
    else:
        message = table.get_item(Key={"pk": pk, "sk": f"MESSAGE#{job['messageId']}"}, ConsistentRead=True).get("Item")
        if not message or message["status"] != "approved":
            return
        text = job["text"]
        content_check = {"ConditionCheck": {"TableName": table_name, "Key": encoded({"pk": pk, "sk": message["sk"]}), "ConditionExpression": "#s = :approved", "ExpressionAttributeNames": {"#s": "status"}, "ExpressionAttributeValues": encoded({":approved": "approved"})}}
    audio = synthesize(text)
    now = int(time.time())
    if job["expiresAt"] <= now:
        return
    key = f"{hashlib.sha256(creator_id.encode()).hexdigest()}/{job_id}.wav"
    boto3.client("s3").put_object(Bucket=os.environ["AUDIO_BUCKET"], Key=key, Body=audio, ContentType="audio/wav", ServerSideEncryption="AES256")
    alert_id = f"speech-{job_id}"
    alert = {"alertId": alert_id, "kind": "speech", "createdAt": now, "expiresAt": job["expiresAt"]}
    alert_row = {"pk": pk, "sk": f"ALERT#{alert_id}", "version": 1, "alert": alert, "audioKey": key, "ttl": now + 604800}
    outbox = {"pk": pk, "sk": f"OUTBOX#{alert_id}", "version": 1, "type": "alert", "alertId": alert_id, "status": "pending", "createdAt": now, "ttl": now + 604800, "gsiPk": "OUTBOX", "gsiSk": f"{now}#{creator_id}#{alert_id}"}
    try:
        boto3.client("dynamodb").transact_write_items(TransactItems=[
            {"ConditionCheck": {"TableName": table_name, "Key": encoded({"pk": pk, "sk": "PROFILE"}), "ConditionExpression": "deleted = :no AND (attribute_not_exists(banned) OR banned = :no)", "ExpressionAttributeValues": encoded({":no": False})}},
            content_check,
            {"Update": {"TableName": table_name, "Key": encoded({"pk": pk, "sk": job["sk"]}), "UpdateExpression": "SET #s=:ready, #v=#v+:one", "ConditionExpression": "#v=:version AND expiresAt>:now", "ExpressionAttributeNames": {"#s": "status", "#v": "version"}, "ExpressionAttributeValues": encoded({":ready": "ready", ":one": 1, ":version": job["version"], ":now": now})}},
            {"Put": {"TableName": table_name, "Item": encoded(alert_row), "ConditionExpression": "attribute_not_exists(pk)"}},
            {"Put": {"TableName": table_name, "Item": encoded(outbox), "ConditionExpression": "attribute_not_exists(pk)"}},
        ])
    except boto3.client("dynamodb").exceptions.TransactionCanceledException:
        current = table.get_item(Key={"pk": pk, "sk": job["sk"]}, ConsistentRead=True).get("Item")
        if current and current.get("status") == "ready":
            return
        raise


def handler(event, context):
    failures = []
    for record in event.get("Records", []):
        started = time.monotonic()
        try:
            payload = json.loads(record["body"])
            process(payload["creatorId"], payload["jobId"])
            print(json.dumps({"event": "speech_processed", "correlationId": record["messageId"], "durationMs": round((time.monotonic() - started) * 1000)}))
        except Exception:
            print(json.dumps({"event": "speech_failed", "correlationId": record["messageId"]}))
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
