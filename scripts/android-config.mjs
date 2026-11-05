import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export function publicConfig(stage, values) {
  if (!['development', 'production'].includes(stage)) throw new Error('Invalid Android stage');
  const fields = {
    apiUrl: 'ANDROID_API_URL',
    cognitoDomain: 'ANDROID_COGNITO_DOMAIN',
    mobileClientId: 'ANDROID_COGNITO_CLIENT_ID',
    webUrl: 'ANDROID_WEB_URL',
  };
  const config = { stage };
  for (const [field, key] of Object.entries(fields)) {
    const value = (values[key] || '').trim();
    if (value) {
      if (field === 'mobileClientId') {
        if (!/^[a-zA-Z0-9]+$/.test(value)) throw new Error(`Invalid ${key}`);
      } else {
        let url;
        try {
          url = new URL(value);
        } catch {
          throw new Error(`Invalid ${key}`);
        }
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
          throw new Error(`${key} must be an HTTPS URL without credentials, query or fragment`);
        if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
          throw new Error(`${key} must use a deployed endpoint`);
      }
    }
    config[field] = field === 'mobileClientId' ? value : value.replace(/\/+$/, '');
  }
  if (stage === 'production' && Object.values(fields).some((key) => !values[key]?.trim()))
    throw new Error('Production Android configuration requires all four ANDROID_* values');
  return config;
}
export function loadConfig(stage, environment = process.env) {
  if (!['development', 'production'].includes(stage)) throw new Error('Invalid Android stage');
  const filename = resolve(root, `.env.android.${stage}.local`);
  const values = existsSync(filename) ? parseEnv(readFileSync(filename, 'utf8')) : {};
  // CI environment values override the file. No generic env-object is ever serialized.
  return publicConfig(stage, { ...values, ...environment });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(
      JSON.stringify(loadConfig(process.env.TIPRELAY_ANDROID_STAGE || 'development')),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
