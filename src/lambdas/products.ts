import { v4 as uuidv4 } from 'uuid';
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { buildResponse } from '../utils/index.ts';

const client = new DynamoDBClient({});
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent) => {
  const { httpMethod, pathParameters, body } = event;
  const productId = pathParameters?.productId;
  const origin = event.headers.origin || event.headers.Origin;

  try {
    if (httpMethod === 'GET' && productId) {
      const res = await client.send(
        new GetItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: marshall({ id: productId }),
        }),
      );

      if (!res.Item) {
        return buildResponse(404, { message: 'Product not found' }, origin);
      }

      const item = unmarshall(res.Item);
      // TODO: Authentication and authorization

      return buildResponse(200, item, origin);
    }
    if (httpMethod === 'GET') {
      const res = await client.send(
        new ScanCommand({ TableName: PRODUCTS_TABLE_NAME }),
      );

      // TOOD: Do not forget Auhentication with filter
      const items = res.Items?.map((item) => unmarshall(item)) ?? [];

      return buildResponse(200, items, origin);
    }

    if (httpMethod === 'POST' && body) {
      let item = JSON.parse(body);
      item = {
        id: item.id ?? uuidv4(),
        ...item,
        // userId, TODO add userID from authentication
      };

      await client.send(
        new PutItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Item: marshall(item),
        }),
      );

      return buildResponse(201, item, origin);
    }

    if (httpMethod === 'PUT' && productId && body) {
      const updated = JSON.parse(body);
      updated.id = productId;
      // TODO: Authentication
      // updated.userId = userId;

      await client.send(
        new PutItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Item: marshall(updated),
        }),
      );

      return buildResponse(200, updated, origin);
    }

    if (httpMethod === 'DELETE' && productId) {
      const res = await client.send(
        new GetItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: marshall({ id: productId }),
        }),
      );

      if (!res.Item) {
        return buildResponse(404, { message: 'Product not found' }, origin);
      }

      // TODO: Authentication
      // const item = unmarshall(res.Item);
      // if (item.userId !== userId) {
      //   return buildResponse(403, { message: 'Forbidden' }, origin);
      // }

      await client.send(
        new DeleteItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: marshall({ id: productId }),
        }),
      );

      return buildResponse(200, { message: 'Deleted' }, origin);
    }

    return buildResponse(
      400,
      {
        message: 'Unsupported method or missing data.',
      },
      origin,
    );
  } catch (err) {
    return buildResponse(500, { error: (err as Error).message }, origin);
  }
};
