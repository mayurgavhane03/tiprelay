import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { route } from '../http/router';
import { service } from './runtime';
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  clientId: [process.env.USER_POOL_CLIENT_ID!, process.env.MOBILE_CLIENT_ID!].filter(Boolean),
  tokenUse: 'access',
});
export async function handler(event: any) {
  const correlationId = event.requestContext.requestId;
  if (event.requestContext.http.method === 'OPTIONS') return { statusCode: 204 };
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-correlation-id': correlationId,
  };
  let creatorId: string | undefined;
  const token = (event.headers?.authorization || '').replace(/^Bearer /, '');
  if (
    /^\/v1\/(dashboard|account|admin)(\/|$)/.test(event.rawPath) ||
    event.rawPath === '/v1/device/pair'
  ) {
    try {
      creatorId = (await verifier.verify(token)).sub;
    } catch {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Sign in required', correlationId }),
      };
    }
  }
  if (Buffer.byteLength(event.body || '') > 8192) return { statusCode: 413, headers, body: '{}' };
  let body;
  try {
    body = event.body
      ? JSON.parse(
          event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body,
        )
      : undefined;
  } catch {
    return { statusCode: 400, headers, body: '{}' };
  }
  const result = await route(service, {
    method: event.requestContext.http.method,
    path: event.rawPath,
    body,
    token,
    creatorId,
    ip: event.requestContext.http.sourceIp,
    correlationId,
    cursor: event.queryStringParameters?.cursor,
  });
  return { statusCode: result.status, headers, body: JSON.stringify(result.body) };
}
