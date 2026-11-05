import { App } from 'aws-cdk-lib';
import { TipRelayStack } from '../lib/tiprelay-stack';
import { SpeechBuildStack } from '../lib/speech-build-stack';
const app = new App();
const stage = app.node.tryGetContext('stage') || 'development';
if (!['development', 'production'].includes(stage))
  throw new Error('stage must be development or production');
const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
};
const speech = new SpeechBuildStack(
  app,
  stage === 'production' ? 'TipRelaySpeechBuildProd' : 'TipRelaySpeechBuildDev',
  { stage, env: environment },
);
new TipRelayStack(app, stage === 'production' ? 'TipRelayProd' : 'TipRelayDev', {
  stage,
  env: environment,
  speechRepository: speech.repository,
  speechImageDigest: app.node.tryGetContext('speechImageDigest'),
  skipSpeechWorker: app.node.tryGetContext('skipSpeechWorker') === 'true',
  skipCloudFront: app.node.tryGetContext('skipCloudFront') === 'true',
});
