import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';

import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PriceTrackerAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'Products',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const receiptsBucket = new Bucket(this, 'ReceiptsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ expiration: cdk.Duration.days(5) }],
    });

    const priceTrackerLambda = new lambdaNode.NodejsFunction(
      this,
      'PriceTrackerHandler',
      {
        entry: join(__dirname, '../lambdas/products.ts'),
        handler: 'handler',
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
        },
      },
    );
    const analyzeImageReceiptLambda = new lambdaNode.NodejsFunction(
      this,
      'AnalyzeImageReceiptHandler',
      {
        entry: join(__dirname, '../lambdas/analyze-image-receipt.ts'),
        handler: 'handler',
        runtime: Runtime.NODEJS_LATEST,
        environment: {
          RECEIPTS_BUCKET: receiptsBucket.bucketName,
        },
        timeout: cdk.Duration.seconds(25),
      },
    );
    analyzeImageReceiptLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['textract:DetectDocumentText'],
        resources: ['*'],
      }),
    );
    analyzeImageReceiptLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'aws-marketplace:ViewSubscriptions',
          'aws-marketplace:Subscribe',
        ],
        resources: ['*'],
      }),
    );

    receiptsBucket.grantPut(analyzeImageReceiptLambda);

    const userPoolClientId = cdk.Fn.importValue('UserPoolClientId');
    const signInLambda = new lambdaNode.NodejsFunction(this, 'SignInHandler', {
      entry: join(__dirname, '../lambdas/sign-in.ts'),
      handler: 'handler',
      environment: {
        COGNITO_CLIENT_ID: userPoolClientId,
      },
    });
    const respondToChallengeLambda = new lambdaNode.NodejsFunction(
      this,
      'RespondToChanllengeHandler',
      {
        entry: join(__dirname, '../lambdas/respond-to-challenge.ts'),
        handler: 'handler',
        environment: {
          COGNITO_CLIENT_ID: userPoolClientId,
        },
      },
    );
    const refreshTokenLambda = new lambdaNode.NodejsFunction(
      this,
      'RefreshTokenHandler',
      {
        entry: join(__dirname, '../lambdas/refresh-token.ts'),
        handler: 'handler',
        environment: {
          COGNITO_CLIENT_ID: userPoolClientId,
        },
      },
    );
    const getCognitoUserLambda = new lambdaNode.NodejsFunction(
      this,
      'GetCognitoUserHandler',
      {
        entry: join(__dirname, '../lambdas/get-user.ts'),
        handler: 'handler',
      },
    );

    productsTable.grantReadWriteData(priceTrackerLambda);

    const userPoolId = cdk.Fn.importValue('UserPoolId');
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'ImportedUserPool',
      userPoolId,
    );
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'PriceTrackerAuthorizer',
      { cognitoUserPools: [userPool] },
    );

    const priceTrackerApi = new apigateway.RestApi(this, 'PriceTrackerApi', {
      restApiName: 'Price Tracker Service',
      binaryMediaTypes: ['image/jpeg', 'image/png', 'multipart/form-data'],
      deployOptions: { stageName: 'prod' },
    });

    priceTrackerApi.root
      .addResource('get-user')
      .addMethod('GET', new apigateway.LambdaIntegration(getCognitoUserLambda));
    priceTrackerApi.root
      .addResource('sign-in')
      .addMethod('POST', new apigateway.LambdaIntegration(signInLambda));
    priceTrackerApi.root
      .addResource('respond-to-challenge')
      .addMethod(
        'POST',
        new apigateway.LambdaIntegration(respondToChallengeLambda),
      );
    priceTrackerApi.root
      .addResource('refresh-token')
      .addMethod('POST', new apigateway.LambdaIntegration(refreshTokenLambda));

    const productsResource = priceTrackerApi.root.addResource('products');
    productsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );
    productsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );

    const productResource = productsResource.addResource('{productId}');
    productResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );
    productResource.addMethod(
      'PATCH',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );
    productResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );

    priceTrackerApi.root
      .addResource('analyze-receipt')
      .addMethod(
        'POST',
        new apigateway.LambdaIntegration(analyzeImageReceiptLambda),
        {
          authorizationType: apigateway.AuthorizationType.COGNITO,
          authorizer,
        },
      );
  }
}
