import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// import storeImageInS3 from '../utils/store-image-in-s3.ts';
import decodeImage from '../utils/decode-image.ts';
import runTextract from '../utils/run-textract.ts';
import parseWithBedrock from '../utils/parse-with-bedrock.ts';
import addConfidence from '../utils/add-confidence.ts';
import buildResponse from '../utils/build-response.ts';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { body, headers, isBase64Encoded } = event;
  // const userId = requestContext.authorizer?.claims?.sub;

  const origin = event.headers.origin || event.headers.Origin;

  if (!body) {
    return buildResponse(
      400,
      {
        message: 'No body received',
      },
      origin,
    );
  }

  const contentType = headers['content-type'] || headers['Content-Type'];

  if (!contentType) {
    return buildResponse(
      400,
      {
        message: 'Missing Content-Type header',
      },
      origin,
    );
  }

  const { fileInfo, imageBuffer } = await decodeImage(
    body,
    contentType,
    isBase64Encoded,
  );

  if (!allowedTypes.includes(fileInfo.mimeType ?? '')) {
    return buildResponse(
      415,
      {
        message: 'Unsupported image type',
      },
      origin,
    );
  }

  if (imageBuffer.length > MAX_SIZE) {
    return buildResponse(
      413,
      {
        message: 'File too large',
      },
      origin,
    );
  }

  try {
    // 1. Sore in S3
    // This is working just don't want to store them right now because I don't have practical use case yet
    // await storeImageInS3(imageBuffer, userId, fileInfo.mimeType);

    // 2. OCR
    const ocrText = await runTextract(imageBuffer);

    // 3. AI parsing
    const aiResult = await parseWithBedrock(ocrText);

    // 4. Confidence Score
    const resultWithConfidence = addConfidence(aiResult);

    return buildResponse(
      200,
      {
        message: 'Image received',
        filename: fileInfo.filename,
        size: imageBuffer.length,
        mimeType: fileInfo.mimeType,
        result: resultWithConfidence,
      },
      origin,
    );
  } catch (err) {
    return buildResponse(500, { error: (err as Error).message }, origin);
  }
};
