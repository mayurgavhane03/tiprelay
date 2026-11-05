import {
  authorize,
  refresh,
  revoke,
  type AuthConfiguration,
} from 'react-native-app-auth';
import { companion } from '../native';
import { deployment } from './config';
let token = '';
let expiresAt = 0;
function configuration(): AuthConfiguration {
  const { cognitoDomain, mobileClientId, apiUrl } = deployment;
  if (
    !cognitoDomain.startsWith('https://') ||
    !apiUrl.startsWith('https://') ||
    !mobileClientId
  )
    throw new Error('Google sign-in is not configured for this build.');
  return {
    clientId: mobileClientId,
    redirectUrl: 'com.tiprelaycompanion:/oauth2redirect',
    scopes: ['openid', 'email', 'profile'],
    usePKCE: true,
    additionalParameters: { identity_provider: 'Google' },
    serviceConfiguration: {
      authorizationEndpoint: `${cognitoDomain}/oauth2/authorize`,
      tokenEndpoint: `${cognitoDomain}/oauth2/token`,
      revocationEndpoint: `${cognitoDomain}/oauth2/revoke`,
    },
  };
}
export async function signIn() {
  const result = await authorize(configuration());
  token = result.accessToken;
  expiresAt = Date.parse(result.accessTokenExpirationDate);
  if (result.refreshToken) await companion.saveSession(result.refreshToken);
  return account();
}
export async function accessToken() {
  if (token && expiresAt > Date.now() + 60000) return token;
  const refreshToken = await companion.readSession();
  if (!refreshToken) throw new Error('Sign in with Google to continue.');
  const result = await refresh(configuration(), { refreshToken });
  token = result.accessToken;
  expiresAt = Date.parse(result.accessTokenExpirationDate);
  if (result.refreshToken) await companion.saveSession(result.refreshToken);
  return token;
}
export async function account(): Promise<{ role: string; creatorId: string }> {
  const result = await fetch(`${deployment.apiUrl}/v1/account`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!result.ok)
    throw new Error(
      result.status === 403
        ? 'This account is suspended.'
        : 'Your account is unavailable. Please sign in again.',
    );
  const current = await result.json();
  const device = await companion.diagnostics();
  if (device.paired && device.creatorId !== current.creatorId)
    await companion.unpair();
  return current;
}
export async function signOut() {
  const saved = await companion.readSession();
  token = '';
  expiresAt = 0;
  await companion.clearSession();
  await companion.unpair();
  if (saved) {
    try {
      await revoke(configuration(), {
        tokenToRevoke: saved,
        sendClientId: true,
      });
    } catch {
      /* Local credentials are already removed. */
    }
  }
}
