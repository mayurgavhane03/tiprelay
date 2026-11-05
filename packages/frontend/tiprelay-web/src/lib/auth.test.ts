import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_COGNITO_DOMAIN', 'https://example.auth.ap-south-1.amazoncognito.com');
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'public-client');
  vi.stubEnv('VITE_LOCAL_MODE', 'false');
  storage = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal('location', {
    origin: 'https://tiprelay.example',
    search: '',
    assign: vi.fn(),
    replace: vi.fn(),
  });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('uses Google-only authorization with state and S256 PKCE', async () => {
  const { login } = await import('./auth');
  await login();
  const url = new URL(vi.mocked(location.assign).mock.calls[0][0]);
  expect(url.searchParams.get('identity_provider')).toBe('Google');
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toBe(storage.get('oauth_state'));
  expect(url.searchParams.get('code_challenge')).not.toBe(storage.get('pkce'));
  expect(url.searchParams.get('redirect_uri')).toBe('https://tiprelay.example/auth/callback');
});
it('rejects a mismatched callback before exchanging a code', async () => {
  const { login, callback } = await import('./auth');
  await login();
  location.search = '?code=untrusted&state=wrong';
  await expect(callback()).rejects.toThrow('Invalid sign-in response');
  expect(fetch).not.toHaveBeenCalled();
  expect(storage.has('oauth_state')).toBe(false);
});
it('exchanges a valid callback and prevents callback reuse', async () => {
  const { login, callback } = await import('./auth');
  await login();
  location.search = `?code=code&state=${storage.get('oauth_state')}`;
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ access_token: 'verified-by-api', token_type: 'Bearer' })),
  );
  await callback();
  expect(storage.get('access_token')).toBe('verified-by-api');
  expect(location.replace).toHaveBeenCalledWith('/dashboard');
  await expect(callback()).rejects.toThrow('Invalid sign-in response');
});
it('clears local credentials and signs out through Cognito', async () => {
  const { logout, hasSession } = await import('./auth');
  storage.set('access_token', 'token');
  storage.set('local_session', 'demo');
  logout();
  expect(hasSession()).toBe(false);
  expect(storage.has('local_session')).toBe(false);
  expect(new URL(vi.mocked(location.assign).mock.calls[0][0]).pathname).toBe('/logout');
});
