import io
import os
import threading
import wave
from pathlib import Path

_voice = None
_lock = threading.Lock()


def synthesize(text: str) -> bytes:
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 240:
        raise ValueError("Text must contain 1 to 240 characters")
    global _voice
    with _lock:
        if _voice is None:
            from piper import PiperVoice
            model = Path(os.environ.get("VOICE_PATH", Path(__file__).parent / "voices/en_US-ljspeech-high.onnx"))
            _voice = PiperVoice.load(str(model))
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            _voice.synthesize_wav(text.strip(), wav)
        return output.getvalue()
