import {
  AuthFlowType,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { COGNITO_CLIENT_ID, cognitoClient } from '../utils/cognito-client.ts';
import buildResponse from '../utils/build-response.ts';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const { refreshToken } = JSON.parse(event.body || '{}');

    if (!refreshToken) {
      return buildResponse(400, {
        message: 'Missing refresh token.',
      });
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Token refresh failed');
    }

    const tokens = {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken, // unchanged
    };

    return buildResponse(200, { tokens });
  } catch (error: unknown) {
    console.error('Refresh token error:', error);

    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Failed to refresh tokens' }),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
