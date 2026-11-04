# Speech engine and model record

Checked against upstream sources on 4 November 2026. The selected release voice is **English (US), LJ Speech high**, not the Lessac example in the reference brief. Its upstream card explicitly identifies the training dataset as public domain. The LJ Speech dataset publisher states that the recordings and text are public domain and places no restrictions on use. This supports the intended commercial alert service. Hindi and Hinglish quality have not been evaluated and are not advertised. [Voice model card](https://huggingface.co/rhasspy/piper-voices/blob/e7229f7d33a10e145e109b886d661984201ac3c4/en/en_US/ljspeech/high/MODEL_CARD), [LJ Speech dataset](https://keithito.com/LJ-Speech-Dataset/).

Piper is pinned to `piper-tts==1.3.0`, from the maintained OHF-Voice fork. Its engine license is GPLv3. Commercial use is permitted under those terms. If you distribute the worker image or a combined worker product, provide the applicable GPL license notices and corresponding source, including changes, build instructions and covered dependencies. The selected voice remains governed by its model/dataset terms. Do not represent the bundled engine as proprietary. [Pinned engine COPYING](https://github.com/OHF-Voice/piper1-gpl/blob/v1.3.0/COPYING), [engine source](https://github.com/OHF-Voice/piper1-gpl/tree/v1.3.0).

The container build includes `PIPER-COPYING`, `MODEL_CARD` and `checksums.json` under `/opt/voices`. `voice.json` pins the model repository revision and SHA-256 digests. `download_voice.py` verifies each artifact. The engine and model are downloaded at build time and bundled into the image.

| Artifact                        | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `en_US-ljspeech-high.onnx`      | `5d4f08ba6a2a48c44592eed3ce56bf85e9de3dd4e20df90541ae68a8310c029a` |
| `en_US-ljspeech-high.onnx.json` | `7e1f4634af596d83cca997fb7a931ba80b70f8a316a2655ee69c55365e0ace14` |
| `MODEL_CARD`                    | `289f7421072d689a3d91f6c632f486af46f9b8b04417536104a4ea667b8a394b` |

Before distributing a container outside your controlled service, archive the exact engine source tag, worker source, build recipe and dependency notices, including the phonemizer’s notices. The repository does not select a blanket license for the rest of your product. Record that decision and the distribution compliance package before releasing downloadable images. The generated chime is an original mathematical three-tone waveform with no external sound sample.
