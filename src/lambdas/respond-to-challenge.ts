import {
  ChallengeNameType,
  GetUserCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { COGNITO_CLIENT_ID, cognitoClient } from '../utils/cognito-client.ts';
import buildResponse from '../utils/build-response.ts';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const { username, newPassword, session } = JSON.parse(event.body || '{}');

    if (!username || !newPassword || !session) {
      return buildResponse(400, {
        message: 'Missing required parameters.',
      });
    }

    const command = new RespondToAuthChallengeCommand({
      ClientId: COGNITO_CLIENT_ID,
      ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Challenge response failed');
    }

    const tokens = {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
    };

    const userRes = await cognitoClient.send(
      new GetUserCommand({ AccessToken: tokens.accessToken }),
    );

    const user = {
      username: userRes.Username!,
      attributes: userRes.UserAttributes,
    };

    return buildResponse(200, {
      user,
      tokens,
    });
  } catch (error: unknown) {
    console.error('Challenge error:', error);

    const errorMessages: { [key: string]: string } = {
      InvalidPasswordException: 'Password does not meet requirements',
      CodeMismatchException: 'Invalid session, sign in again',
      ExpiredCodeException: 'Session expired, sign in again',
    };

    const errorName =
      error instanceof Error && 'name' in error
        ? (error as { name: string }).name
        : 'Unknown';

    const friendly: string =
      errorMessages[errorName] || 'Password change failed.';

    return buildResponse(400, {
      message: friendly,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
