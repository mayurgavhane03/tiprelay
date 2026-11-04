import { App } from 'aws-cdk-lib';
import { TipRelayStack } from '../lib/tiprelay-stack';
const app = new App();
const stage = app.node.tryGetContext('stage') || 'development';
if (!['development', 'production'].includes(stage))
  throw new Error('stage must be development or production');
new TipRelayStack(app, stage === 'production' ? 'TipRelayProd' : 'TipRelayDev', {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
  },
});
