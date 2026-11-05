import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicConfig, loadConfig } from './android-config.mjs';
const values = {
  ANDROID_API_URL: 'https://api.example.com/',
  ANDROID_COGNITO_DOMAIN: 'https://signin.example.com',
  ANDROID_COGNITO_CLIENT_ID: 'mobile123',
  ANDROID_WEB_URL: 'https://example.com',
};
test('only public allowlisted fields enter the native configuration', () => {
  const config = publicConfig('production', {
    ...values,
    GOOGLE_CLIENT_SECRET: 'private',
    TIPRELAY_STORE_PASSWORD: 'private',
    AWS_SECRET_ACCESS_KEY: 'private',
  });
  assert.deepEqual(
    Object.keys(config).sort(),
    ['apiUrl', 'cognitoDomain', 'mobileClientId', 'stage', 'webUrl'].sort(),
  );
  assert.equal(config.apiUrl, 'https://api.example.com');
  assert.ok(!JSON.stringify(config).includes('private'));
});
test('production requires every public value', () => {
  for (const key of Object.keys(values))
    assert.throws(() => publicConfig('production', { ...values, [key]: '' }));
  assert.equal(publicConfig('development', {}).apiUrl, '');
});
test('rejects credentials, unsafe URLs, query strings and malformed client IDs', () => {
  for (const url of [
    'http://api.example.com',
    'https://user:password@api.example.com',
    'https://api.example.com?secret=x',
    'https://api.example.com#x',
    'https://localhost',
    'bad',
  ])
    assert.throws(() => publicConfig('production', { ...values, ANDROID_API_URL: url }));
  assert.throws(() =>
    publicConfig('production', { ...values, ANDROID_COGNITO_CLIENT_ID: 'unsafe\nvalue' }),
  );
});
test('CI public values work without reading unrelated secrets', () => {
  assert.equal(loadConfig('production', values).mobileClientId, 'mobile123');
  assert.throws(() => loadConfig('invalid', values));
});
