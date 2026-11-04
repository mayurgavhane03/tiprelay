import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const python =
  process.env.TIPRELAY_PYTHON ||
  resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
if (!existsSync(python))
  throw new Error(
    'Create .venv and install the speech requirements first. See docs/local-development.md.',
  );
const child = spawn(python, [resolve(root, 'packages/backend/speech-worker/local_server.py')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VOICE_PATH: process.env.VOICE_PATH || resolve(root, '.local/voices/en_US-ljspeech-high.onnx'),
  },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => child.kill());
