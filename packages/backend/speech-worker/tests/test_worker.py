import unittest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from synthesis import synthesize


class WorkerTests(unittest.TestCase):
    def test_amount_announcement_uses_normalized_name_without_viewer_message(self):
        import worker
        table = MagicMock()
        table.get_item.side_effect = [
            {"Item": {"sk": "JOB#amount-a", "kind": "amount", "sourceAlertId": "a", "payerName": "Example Supporter", "status": "pending", "expiresAt": 2000, "version": 1}},
            {"Item": {"deleted": False}},
            {"Item": {"sk": "ALERT#a", "alert": {"kind": "credit", "amountPaise": 10050}}},
        ]
        with patch.dict(worker.os.environ, {"TABLE_NAME": "test", "AUDIO_BUCKET": "audio"}), patch.object(worker.time, "time", return_value=1000), patch.object(worker.boto3, "resource") as resource, patch.object(worker.boto3, "client") as client, patch.object(worker, "synthesize", return_value=b"wav") as synth:
            resource.return_value.Table.return_value = table
            worker.process("alice", "amount-a")
            synth.assert_called_once_with("100 rupees and 50 paise received from Example Supporter. Thank you for your support.")
            client.return_value.transact_write_items.assert_called_once()

    def test_text_bounds(self):
        for text in ("", " " * 2, "x" * 241, None):
            with self.assertRaises(ValueError):
                synthesize(text)

    def test_sqs_failure_is_retriable_without_sensitive_logs(self):
        import worker
        with patch.object(worker, "process", side_effect=RuntimeError("private text")):
            result = worker.handler({"Records": [{"messageId": "safe-correlation", "body": '{"creatorId":"test","jobId":"job"}'}]}, None)
        self.assertEqual(result, {"batchItemFailures": [{"itemIdentifier": "safe-correlation"}]})


if __name__ == "__main__":
    unittest.main()
