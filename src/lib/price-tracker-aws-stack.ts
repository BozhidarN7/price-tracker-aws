import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

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
      deployOptions: { stageName: 'prod' },
    });

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
      'PUT',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );
    productResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(priceTrackerLambda),
      { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer },
    );
  }
}
