import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, loadConfig } from './android-config.mjs';

const release = ['release', 'bundle'].includes(process.argv[2]);
if (!['debug', 'release', 'bundle'].includes(process.argv[2]))
  throw new Error('Use debug, release or bundle');
const stage = release ? 'production' : 'development';
loadConfig(stage); // Validate before invoking Gradle. Never print configuration or secrets.
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (
  (!sdk &&
    !existsSync(resolve(root, 'packages/frontend/tiprelay-android/android/local.properties'))) ||
  (sdk && !existsSync(sdk))
) {
  throw new Error(
    'Android SDK is not configured. Install SDK 36 and set ANDROID_HOME, or configure android/local.properties.',
  );
}
const env = { ...process.env, TIPRELAY_ANDROID_STAGE: stage };
if (release) {
  const path = resolve(root, '.env.android.signing.local');
  const signing = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  for (const key of [
    'TIPRELAY_KEYSTORE',
    'TIPRELAY_STORE_PASSWORD',
    'TIPRELAY_KEY_ALIAS',
    'TIPRELAY_KEY_PASSWORD',
  ]) {
    env[key] = process.env[key] || signing[key];
    if (!env[key]) throw new Error(`Missing release signing variable ${key}`);
  }
  env.TIPRELAY_KEYSTORE = resolve(root, env.TIPRELAY_KEYSTORE);
  if (!existsSync(env.TIPRELAY_KEYSTORE)) throw new Error('Release keystore does not exist');
}
const result = spawnSync(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [process.argv[2] === 'bundle' ? 'bundleRelease' : release ? 'assembleRelease' : 'assembleDebug'],
  {
    cwd: resolve(root, 'packages/frontend/tiprelay-android/android'),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);
if (result.error) console.error('Unable to launch Gradle. Check Java and Android SDK setup.');
process.exitCode = result.status ?? 1;
