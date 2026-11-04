# Local development

All commands run from the repository root in PowerShell unless a command explicitly changes directory. The initial setup is in the root README. The root `.env` is inherited by both dev child processes. Restart after changing it.

Turborepo coordinates the workspaces. `npm run dev` starts web and API, `npm run dev:all` also starts Piper and Metro, and `dev:web`, `dev:api`, `dev:speech`, `dev:android` select individual processes. `dev:all` requires the Python virtual environment and downloaded model first. The file store remains single-process even when Turbo is used.

## Storage

Default `STORAGE=file` persists to `.local/state.json`. Stop the API before running `db:seed` or editing local state. Never share this adapter across processes or hosts. `STORAGE=dynamo` uses the exact DynamoDB adapter used in AWS with dummy credentials and an explicit local endpoint. Start Docker Compose first. Do not point the seed command at AWS.

If Docker is unavailable, DynamoDB Local can run from its official Java distribution, using JDK 17+.

```powershell
New-Item -ItemType Directory -Force .local/dynamodb | Out-Null
Invoke-WebRequest https://s3.ap-south-1.amazonaws.com/dynamodb-local-mumbai/dynamodb_local_latest.tar.gz -OutFile .local/dynamodb/archive.tar.gz
tar -xzf .local/dynamodb/archive.tar.gz -C .local/dynamodb
java '-Djava.library.path=.local/dynamodb/DynamoDBLocal_lib' -jar .local/dynamodb/DynamoDBLocal.jar -sharedDb -inMemory -port 8000
# Another terminal
$env:STORAGE='dynamo'
npm run db:seed
npm run test:dynamo
npm run dev
```

The Java `-inMemory` option loses data on restart. The Compose volume persists state. DynamoDB Local listens on its own port. Restrict that port with the host firewall when using the Java process.

## Piper

The worker uses English LJ Speech high with an immutable repository revision and documented checksums. No model download occurs during request processing.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r packages/backend/speech-worker/requirements.txt
.venv\Scripts\python.exe packages/backend/speech-worker/download_voice.py .local/voices
$env:VOICE_PATH=(Resolve-Path '.local/voices/en_US-ljspeech-high.onnx').Path
.venv\Scripts\python.exe packages/backend/speech-worker/local_server.py
```

Keep the API and web servers running in another terminal. Submit a message on `/tip/demo`, then approve a matching observed credit in Message review. Speech must finish and begin playback within two minutes of approval. For a containerized local worker use `docker compose --profile speech up --build speech` instead.

```powershell
.venv\Scripts\python.exe -m unittest discover -s packages/backend/speech-worker/tests
```

## Companion over USB

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3001 tcp:3001
npm run start --workspace @tiprelay/android
# Separate terminal
npm run android --workspace @tiprelay/android
```

Use `http://127.0.0.1:3001` in the debug companion. Only debug builds permit loopback HTTP. Release builds require HTTPS. Pair in the dashboard, grant notification access, and keep the phone connected for local USB tests. Never expose unauthenticated dashboard endpoints on a LAN to connect a phone.

## Smoke and known constraints

`npm run smoke:alert` creates a fresh local overlay credential, exchanges a ticket, opens an actual WebSocket, sends Test Alert, validates the event schema and verifies that the chime WAV is served. It cannot prove OBS mixer routing or audibility. Test credits are isolated from observed-payment statistics.

With Piper running, `npm run smoke:speech` pairs a temporary local device, uploads a synthetic ₹1 credit twice, submits and approves a matching synthetic message, receives the speech event, validates its signed WAV and checks that unsigned audio access is denied. It revokes the temporary device afterward. This command leaves a clearly synthetic message and credit in the demo history and rotates the demo overlay URL.

The local API allows the exact configured web origin and loopback host names. If a browser shows a CORS error, use `http://127.0.0.1:5173`, not a different localhost spelling. Local credentials and audio are under ignored `.local/`; never commit or share that directory.
