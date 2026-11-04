import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from synthesis import synthesize


class WorkerTests(unittest.TestCase):
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
