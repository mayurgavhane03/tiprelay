"""Loopback-only speech adapter. The Node adapter handles approval and signed delivery."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from synthesis import synthesize


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.path != "/synthesize" or not 0 < length <= 4096:
                self.send_error(400)
                return
            audio = synthesize(json.loads(self.rfile.read(length))["text"])
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception:
            self.send_error(503, "Speech unavailable")


if __name__ == "__main__":
    # Container port is published to host loopback only by Compose.
    host = "0.0.0.0" if os.environ.get("SPEECH_CONTAINER") == "true" else "127.0.0.1"
    print(f"TipRelay speech listening on {host}:5000", flush=True)
    HTTPServer((host, 5000), Handler).serve_forever()
