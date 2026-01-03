import {
  DetectDocumentTextCommand,
  TextractClient,
} from '@aws-sdk/client-textract';

const textract = new TextractClient();

export default async function runTextract(imageBuffer: Buffer) {
  const result = await textract.send(
    new DetectDocumentTextCommand({ Document: { Bytes: imageBuffer } }),
  );

  return (
    result.Blocks?.filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text)
      .join('\n') || ''
  );
}
