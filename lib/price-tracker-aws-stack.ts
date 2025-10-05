import path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class PriceTrackerAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'Products',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const priceTrackerLambda = new lambda.Function(
      this,
      'PriceTrackerHandler',
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'products.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
        },
      },
    );

    productsTable.grantReadWriteData(priceTrackerLambda);

    const priceTrackerApi = new apigateway.RestApi(this, 'PriceTrackerApi', {
      restApiName: 'Price Tracker Service',
      deployOptions: { stageName: 'prod' },
    });

    const productsResource = priceTrackerApi.root.addResource('products');
    productsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(priceTrackerLambda),
    );
    productsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(priceTrackerLambda),
    );

    const productResource = productsResource.addResource('{productId}');
    productResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(priceTrackerLambda),
    );
    productResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(priceTrackerLambda),
    );
    productResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(priceTrackerLambda),
    );
  }
}
