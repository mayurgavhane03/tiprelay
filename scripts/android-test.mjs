import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [':app:testDebugUnitTest'],
  {
    cwd: 'packages/frontend/tiprelay-android/android',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);
process.exit(result.status ?? 1);
