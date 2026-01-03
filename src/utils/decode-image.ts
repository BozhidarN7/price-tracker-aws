import Busboy from 'busboy';

export default async function decodeImage(
  body: string,
  contentType: string,
  isBase64Encoded: boolean,
) {
  const busboy = Busboy({
    headers: { 'content-type': contentType },
  });
  const fileBuffers: Buffer[] = [];
  let fileInfo: {
    filename?: string;
    mimeType?: string;
  } = {};

  busboy.on('file', (_, file, info) => {
    fileInfo = {
      filename: info.filename,
      mimeType: info.mimeType,
    };

    file.on('data', (data) => {
      fileBuffers.push(data);
    });
  });

  const buffer = Buffer.from(body, isBase64Encoded ? 'base64' : 'utf8');

  busboy.end(buffer);

  await new Promise((resolve, reject) => {
    busboy.on('finish', resolve);
    busboy.on('error', reject);
  });

  const imageBuffer = Buffer.concat(fileBuffers);

  return { fileInfo, imageBuffer };
}
