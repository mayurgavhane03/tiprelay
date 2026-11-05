import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const filename = process.argv[2] || 'cdk.out/TipRelayDev.template.json';
const template = JSON.parse(readFileSync(filename, 'utf8'));
const resources = Object.values(template.Resources);
const clients = resources.filter((r) => r.Type === 'AWS::Cognito::UserPoolClient');
assert.equal(clients.length, 2, 'Web and Android must have separate clients');
for (const { Properties: p } of clients) {
  assert.deepEqual(p.SupportedIdentityProviders, ['Google']);
  assert.deepEqual(p.AllowedOAuthFlows, ['code']);
  assert.deepEqual(p.ExplicitAuthFlows, ['ALLOW_REFRESH_TOKEN_AUTH']);
  assert.equal(p.GenerateSecret, false);
}
const routes = resources.filter((r) => r.Type === 'AWS::ApiGatewayV2::Route');
for (const route of [
  'ANY /v1/account',
  'ANY /v1/admin/{proxy+}',
  'ANY /v1/dashboard',
  'ANY /v1/dashboard/{proxy+}',
  'ANY /v1/device/pair',
]) {
  assert.equal(
    routes.find((r) => r.Properties.RouteKey === route)?.Properties.AuthorizationType,
    'JWT',
    `${route} must require JWT authentication`,
  );
}
const pool = resources.find((r) => r.Type === 'AWS::Cognito::UserPool');
assert.equal(pool.Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly, true);
console.log(
  'PASS Google-only clients, separate mobile client, and protected account/admin/pairing routes',
);
