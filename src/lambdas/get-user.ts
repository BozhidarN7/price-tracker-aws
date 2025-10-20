import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import buildResponse from '../utils/build-response.ts';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const accessToken = event.headers.Authorization;

    if (!accessToken) {
      return buildResponse(401, {
        message: 'Missing access token',
      });
    }

    const command = new GetUserCommand({ AccessToken: accessToken });
    const response = await cognitoClient.send(command);

    const user = {
      username: response.Username!,
      attributes: response.UserAttributes,
    };

    return buildResponse(200, {
      user,
    });
  } catch (error: unknown) {
    console.error('Get user error:', error);

    return buildResponse(500, {
      message: 'Failed to get user info',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
