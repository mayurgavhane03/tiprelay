"""Download the immutable voice revision at build time, never during a request."""
import hashlib
import json
from pathlib import Path
import urllib.request

BASE = Path(__file__).resolve().parent


def download(destination: Path) -> None:
    manifest = json.loads((BASE / "voice.json").read_text())
    destination.mkdir(parents=True, exist_ok=True)
    base_url = f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}/{manifest['path']}"
    checksums = {}
    for filename in (manifest["name"] + ".onnx", manifest["name"] + ".onnx.json", "MODEL_CARD"):
        target = destination / filename
        with urllib.request.urlopen(f"{base_url}/{filename}", timeout=180) as response:
            target.write_bytes(response.read())
        checksums[filename] = hashlib.sha256(target.read_bytes()).hexdigest()
        expected = manifest.get("sha256", {}).get(filename)
        if expected and checksums[filename] != expected:
            target.unlink()
            raise ValueError(f"Checksum mismatch for {filename}")
    (destination / "checksums.json").write_text(json.dumps(checksums, indent=2))
    with urllib.request.urlopen("https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/v1.3.0/COPYING", timeout=30) as response:
        (destination / "PIPER-COPYING").write_bytes(response.read())


if __name__ == "__main__":
    import sys
    download(Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "voices")
