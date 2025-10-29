import { v4 as uuidv4 } from 'uuid';
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { buildResponse, computeTendencyMetrics } from '../utils/index.ts';
import { formatDate } from '../utils/convert-dates.ts';

const client = new DynamoDBClient({});
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent) => {
  const { httpMethod, pathParameters, body, requestContext } = event;
  const productId = pathParameters?.productId;
  const origin = event.headers.origin || event.headers.Origin;

  const userId = requestContext.authorizer?.claims?.sub;
  if (!userId) {
    return buildResponse(401, { message: 'Unauthorized' }, origin);
  }

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
      if (item.userId !== userId) {
        return buildResponse(403, { message: 'Forbidden' }, origin);
      }

      return buildResponse(200, item, origin);
    }
    if (httpMethod === 'GET') {
      const res = await client.send(
        new ScanCommand({ TableName: PRODUCTS_TABLE_NAME }),
      );

      const items =
        res.Items?.map((item) => unmarshall(item)).filter(
          (item) => item.userId === userId,
        ) ?? [];

      return buildResponse(200, items, origin);
    }

    if (httpMethod === 'POST' && body) {
      let item = JSON.parse(body);
      const now = new Date().toISOString();

      item.id = item.id ?? uuidv4();
      item.userId = userId;
      item.createdAt = item.createdAt ?? now;
      item.updatedAt = now;

      // Initialize price history if missing
      if (!item.priceHistory || item.priceHistory.length === 0) {
        item.priceHistory = [
          {
            priceEntryId: uuidv4(),
            date: formatDate(now),
            price: item.latestPrice,
            currency: item.latestCurrency,
            store: item.store,
          },
        ];
      }

      const analytics = computeTendencyMetrics(item.priceHistory);
      item = { ...item, ...analytics };

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
      const now = new Date().toISOString();

      // Fetch current product
      const existing = await client.send(
        new GetItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: marshall({ id: productId, userId }),
        }),
      );

      if (!existing.Item) {
        return buildResponse(404, { message: 'Product not found' }, origin);
      }

      const current = unmarshall(existing.Item);

      // If price changed → append new entry to history
      if (updated.latestPrice && updated.latestPrice !== current.latestPrice) {
        const newEntry = {
          priceEntryId: uuidv4(),
          date: now,
          price: updated.latestPrice,
          currency: updated.latestCurrency || current.latestCurrency,
          store: updated.store || current.store || 'Unknown',
        };
        current.priceHistory = [...(current.priceHistory || []), newEntry];
      }

      // Merge updates
      const merged = {
        ...current,
        ...updated,
        updatedAt: now,
      };

      const analytics = computeTendencyMetrics(merged.priceHistory || []);
      const finalItem = { ...merged, ...analytics };

      await client.send(
        new PutItemCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Item: marshall(finalItem),
        }),
      );

      return buildResponse(200, finalItem, origin);
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

      const item = unmarshall(res.Item);
      if (item.userId !== userId) {
        return buildResponse(403, { message: 'Forbidden' }, origin);
      }

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
