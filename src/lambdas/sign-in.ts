import type { APIGatewayProxyEvent } from 'aws-lambda';
import {
  AuthFlowType,
  ChallengeNameType,
  GetUserCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import buildResponse from '../utils/build-response.ts';
import { COGNITO_CLIENT_ID, cognitoClient } from '../utils/cognito-client.ts';

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const { username, password } = JSON.parse(event.body || '{}');

    if (!username || !password) {
      return buildResponse(400, {
        message: 'Username and password are required.',
      });
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    // Handle challenge (like NEW_PASSWORD_REQUIRED)
    if (response.ChallengeName) {
      return buildResponse(200, {
        challenge: {
          challengeName: response.ChallengeName,
          session: response.Session,
          challengeParameters: response.ChallengeParameters,
        },
        requiresPasswordChange:
          response.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED,
      });
    }

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed');
    }

    const tokens = {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
    };

    // Fetch user info from Cognito
    const userCmd = new GetUserCommand({
      AccessToken: tokens.accessToken,
    });
    const userRes = await cognitoClient.send(userCmd);

    const user = {
      username: userRes.Username!,
      attributes: userRes.UserAttributes,
    };

    return buildResponse(200, {
      user,
      tokens,
    });
  } catch (error: unknown) {
    console.error('Sign in error:', error);

    const errorMessages: { [key: string]: string } = {
      NotAuthorizedException: 'Invalid username or password',
      UserNotConfirmedException: 'User is not confirmed',
      PasswordResetRequiredException: 'Password reset required',
      UserNotFoundException: 'User not found',
      TooManyRequestsException: 'Too many requests, try again later',
    };

    const errorName =
      error instanceof Error && 'name' in error
        ? (error as { name: string }).name
        : 'Unknown';

    const friendly: string = errorMessages[errorName] || 'Sign in failed.';

    return buildResponse(400, {
      statusCode: 400,
      message: friendly,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
