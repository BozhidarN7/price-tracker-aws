import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION!,
});

export const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
