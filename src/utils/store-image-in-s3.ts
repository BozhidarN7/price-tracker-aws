import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client();

const BUCKET_NAME = process.env.RECEIPTS_BUCKET;

export default async function storeImageInS3(
  imageBuffer: Buffer,
  userId: string,
  mimeType?: string,
) {
  const receiptId = uuidv4();
  const extension = extensionFromMime(mimeType);
  const key = `receipts/${userId}/${receiptId}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ServerSideEncryption: 'AES256',
    }),
  );

  return key;
}

function extensionFromMime(mimeType?: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported image type: ${mimeType}`);
  }
}
