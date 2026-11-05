import {
  Stack,
  Duration,
  RemovalPolicy,
  CfnOutput,
  type StackProps,
  aws_s3 as s3,
  aws_ecr as ecr,
  aws_codebuild as codebuild,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class SpeechBuildStack extends Stack {
  readonly repository: ecr.Repository;
  constructor(scope: Construct, id: string, props: StackProps & { stage: string }) {
    super(scope, id, props);
    this.repository = new ecr.Repository(this, 'SpeechImages', {
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 10 }],
    });
    const source = new s3.Bucket(this, 'SpeechSource', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const project = new codebuild.Project(this, 'SpeechBuilder', {
      source: codebuild.Source.s3({ bucket: source, path: 'speech-source.zip' }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
      },
      timeout: Duration.minutes(30),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: { variables: { REPOSITORY_URI: this.repository.repositoryUri } },
        phases: {
          pre_build: {
            commands: [
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
            ],
          },
          build: {
            commands: [
              'docker build --platform linux/amd64 -t $REPOSITORY_URI:$IMAGE_TAG .',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
            ],
          },
        },
      }),
      environmentVariables: {
        AWS_ACCOUNT_ID: { value: this.account },
        IMAGE_TAG: { value: 'initial' },
      },
    });
    source.grantRead(project);
    this.repository.grantPullPush(project);
    project.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }),
    );
    for (const [name, value] of Object.entries({
      SpeechBuildProject: project.projectName,
      SpeechSourceBucket: source.bucketName,
      SpeechRepository: this.repository.repositoryName,
    }))
      new CfnOutput(this, name, { value });
  }
}
