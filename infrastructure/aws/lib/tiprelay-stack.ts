import {
  Stack,
  Duration,
  RemovalPolicy,
  CfnOutput,
  type StackProps,
  aws_dynamodb as ddb,
  aws_lambda as lambda,
  aws_lambda_event_sources as sources,
  aws_logs as logs,
  aws_sqs as sqs,
  aws_s3 as s3,
  aws_cloudfront as cf,
  aws_cloudfront_origins as origins,
  aws_cognito as cognito,
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations as integrations,
  aws_apigatewayv2_authorizers as authorizers,
  aws_iam as iam,
  aws_cloudwatch as cw,
  aws_events as events,
  aws_events_targets as targets,
  aws_sns as sns,
  aws_cloudwatch_actions as actions,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { resolve } from 'node:path';
export class TipRelayStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & { stage: string }) {
    super(scope, id, props);
    const table = new ddb.Table(this, 'State', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'sk', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: ddb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      stream: ddb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: props.stage === 'production',
    });
    table.addGlobalSecondaryIndex({
      indexName: 'outbox',
      partitionKey: { name: 'gsiPk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'gsiSk', type: ddb.AttributeType.STRING },
      projectionType: ddb.ProjectionType.ALL,
    });
    const audio = new s3.Bucket(this, 'Audio', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { expiration: Duration.days(1), abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const web = new s3.Bucket(this, 'Web', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const distribution = new cf.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(web),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: new cf.ResponseHeadersPolicy(this, 'WebHeaders', {
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
            referrerPolicy: {
              referrerPolicy: cf.HeadersReferrerPolicy.NO_REFERRER,
              override: true,
            },
            strictTransportSecurity: {
              accessControlMaxAge: Duration.days(365),
              includeSubdomains: true,
              override: true,
            },
            frameOptions: { frameOption: cf.HeadersFrameOption.DENY, override: true },
            contentSecurityPolicy: {
              contentSecurityPolicy:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.amazonaws.com wss://*.amazonaws.com https://*.amazoncognito.com; media-src 'self' https://*.amazonaws.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
              override: true,
            },
          },
        }),
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    });
    const origin = `https://${distribution.distributionDomainName}`;
    const pool = new cognito.UserPool(this, 'Creators', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const client = pool.addClient('WebClient', {
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: [origin + '/auth/callback'],
        logoutUrls: [origin],
      },
      accessTokenValidity: Duration.minutes(30),
    });
    const domain = pool.addDomain('SignIn', {
      cognitoDomain: { domainPrefix: `tiprelay-${props.stage}-${this.account}-${this.region}` },
    });
    const dlq = new sqs.Queue(this, 'SpeechDeadLetters', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    });
    const queue = new sqs.Queue(this, 'SpeechJobs', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      visibilityTimeout: Duration.seconds(360),
      retentionPeriod: Duration.days(1),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });
    const environment = {
      APP_ENV: props.stage,
      LOCAL_AUTH_BYPASS: 'false',
      TABLE_NAME: table.tableName,
      AUDIO_BUCKET: audio.bucketName,
      SPEECH_QUEUE_URL: queue.queueUrl,
      USER_POOL_ID: pool.userPoolId,
      USER_POOL_CLIENT_ID: client.userPoolClientId,
      WEB_ORIGIN: origin,
    };
    const make = (name: string, handler: string) =>
      new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler,
        code: lambda.Code.fromAsset(resolve('packages/backend/alert-api/dist')),
        environment,
        timeout: Duration.seconds(25),
        memorySize: 256,
        logGroup: new logs.LogGroup(this, `${name}Logs`, {
          retention: logs.RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.RETAIN,
        }),
      });
    const httpFn = make('Http', 'http.handler'),
      socketFn = make('Socket', 'socket.handler'),
      outboxFn = make('Outbox', 'outbox.handler');
    for (const fn of [httpFn, socketFn, outboxFn]) table.grantReadWriteData(fn);
    const socket = new apigw.WebSocketApi(this, 'OverlaySocket', {
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('Connect', socketFn),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('Disconnect', socketFn),
      },
    });
    socket.addRoute('ready', {
      integration: new integrations.WebSocketLambdaIntegration('Ready', socketFn),
    });
    const socketStage = new apigw.WebSocketStage(this, 'SocketStage', {
      webSocketApi: socket,
      stageName: 'live',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });
    for (const fn of [outboxFn, socketFn]) {
      socket.grantManageConnections(fn);
      fn.addEnvironment('WS_MANAGEMENT_URL', socketStage.callbackUrl);
      audio.grantRead(fn);
    }
    queue.grantSendMessages(outboxFn);
    outboxFn.addEventSource(
      new sources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 25,
        retryAttempts: 5,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,
        filters: [
          lambda.FilterCriteria.filter({
            dynamodb: {
              NewImage: {
                sk: { S: lambda.FilterRule.beginsWith('OUTBOX#') },
                status: { S: lambda.FilterRule.isEqual('pending') },
              },
            },
          }),
        ],
      }),
    );
    new events.Rule(this, 'OutboxRepair', {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [new targets.LambdaFunction(outboxFn)],
    });
    const http = new apigw.HttpApi(this, 'Api', {
      corsPreflight: {
        allowOrigins: [origin],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.PUT,
          apigw.CorsHttpMethod.DELETE,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'authorization'],
      },
    });
    const integration = new integrations.HttpLambdaIntegration('HttpIntegration', httpFn);
    const auth = new authorizers.HttpUserPoolAuthorizer('CreatorAuth', pool, {
      userPoolClients: [client],
    });
    http.addRoutes({
      path: '/v1/dashboard',
      methods: [apigw.HttpMethod.ANY],
      integration,
      authorizer: auth,
    });
    http.addRoutes({
      path: '/v1/dashboard/{proxy+}',
      methods: [apigw.HttpMethod.ANY],
      integration,
      authorizer: auth,
    });
    http.addRoutes({ path: '/v1/public/{proxy+}', methods: [apigw.HttpMethod.ANY], integration });
    http.addRoutes({ path: '/v1/device/{proxy+}', methods: [apigw.HttpMethod.POST], integration });
    http.addRoutes({ path: '/v1/overlay/session', methods: [apigw.HttpMethod.POST], integration });
    const httpStage = http.defaultStage!.node.defaultChild as apigw.CfnStage;
    httpStage.defaultRouteSettings = { throttlingBurstLimit: 100, throttlingRateLimit: 50 };
    const worker = new lambda.DockerImageFunction(this, 'SpeechWorker', {
      code: lambda.DockerImageCode.fromImageAsset(resolve('packages/backend/speech-worker')),
      architecture: lambda.Architecture.X86_64,
      memorySize: 2048,
      timeout: Duration.seconds(60),
      reservedConcurrentExecutions: 4,
      environment: { TABLE_NAME: table.tableName, AUDIO_BUCKET: audio.bucketName },
      logGroup: new logs.LogGroup(this, 'SpeechLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.RETAIN,
      }),
    });
    worker.addEventSource(
      new sources.SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: true }),
    );
    worker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:TransactWriteItems',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:ConditionCheckItem',
        ],
        resources: [table.tableArn],
      }),
    );
    audio.grantPut(worker);
    const alarmTopic = new sns.Topic(this, 'OperationalAlerts', { enforceSSL: true });
    const alarm = (name: string, metric: cw.IMetric, threshold: number) =>
      new cw.Alarm(this, name, {
        metric,
        threshold,
        evaluationPeriods: 1,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new actions.SnsAction(alarmTopic));
    alarm('HttpErrors', httpFn.metricErrors({ period: Duration.minutes(5) }), 5);
    alarm(
      'Api5xx',
      new cw.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: http.apiId },
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      5,
    );
    alarm('SpeechErrors', worker.metricErrors({ period: Duration.minutes(5) }), 1);
    alarm('SpeechDeadLettersAlarm', dlq.metricApproximateNumberOfMessagesVisible(), 1);
    alarm('SpeechBacklogAge', queue.metricApproximateAgeOfOldestMessage(), 60);
    alarm('OutboxFailure', outboxFn.metricErrors(), 1);
    alarm(
      'StaleOutbox',
      new cw.Metric({
        namespace: 'TipRelay',
        metricName: 'OutboxAgeSeconds',
        dimensionsMap: { Stage: props.stage },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      60,
    );
    for (const [name, value] of Object.entries({
      WebUrl: origin,
      WebBucket: web.bucketName,
      ApiUrl: http.apiEndpoint,
      SocketUrl: socketStage.url,
      UserPoolId: pool.userPoolId,
      ClientId: client.userPoolClientId,
      CognitoDomain: domain.baseUrl(),
      TableName: table.tableName,
      AudioBucket: audio.bucketName,
      SpeechQueue: queue.queueUrl,
      AlarmTopic: alarmTopic.topicArn,
      DistributionId: distribution.distributionId,
    }))
      new CfnOutput(this, name, { value });
  }
}
