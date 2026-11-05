const domain = import.meta.env.VITE_COGNITO_DOMAIN;
const client = import.meta.env.VITE_COGNITO_CLIENT_ID;
export const localMode = import.meta.env.DEV && import.meta.env.VITE_LOCAL_MODE === 'true';
export const accessToken = () => sessionStorage.getItem('access_token');
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export async function login() {
  if (!domain || !client) throw new Error('Google sign-in is not enabled in this preview yet.');
  const verifier = encode(crypto.getRandomValues(new Uint8Array(48))),
    state = encode(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem('pkce', verifier);
  sessionStorage.setItem('oauth_state', state);
  const challenge = encode(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const query = new URLSearchParams({
    client_id: client,
    response_type: 'code',
    scope: 'openid email profile',
    identity_provider: 'Google',
    redirect_uri: location.origin + '/auth/callback',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  location.assign(`${domain}/oauth2/authorize?${query}`);
}
export async function callback() {
  const query = new URLSearchParams(location.search),
    state = sessionStorage.getItem('oauth_state'),
    verifier = sessionStorage.getItem('pkce');
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('pkce');
  if (!state || query.get('state') !== state || !verifier || !query.get('code'))
    throw new Error('Invalid sign-in response');
  const response = await fetch(`${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client,
      code: query.get('code')!,
      redirect_uri: location.origin + '/auth/callback',
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error('Sign-in failed');
  const data = await response.json();
  if (typeof data.access_token !== 'string' || data.token_type?.toLowerCase() !== 'bearer')
    throw new Error('Invalid sign-in response');
  sessionStorage.setItem('access_token', data.access_token);
  location.replace('/dashboard');
}
export function logout() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('local_session');
  if (domain && client)
    location.assign(
      `${domain}/logout?${new URLSearchParams({ client_id: client, logout_uri: location.origin })}`,
    );
  else location.assign('/');
}

export const hasSession = () =>
  Boolean(accessToken() || (localMode && sessionStorage.getItem('local_session') === 'demo'));
