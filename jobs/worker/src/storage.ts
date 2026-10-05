import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "./config.js";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }
  return _client;
}

export async function downloadFileBuffer(storagePath: string): Promise<Buffer> {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.r2Bucket, Key: storagePath })
  );
  if (!response.Body) throw new Error(`Empty response from R2: ${storagePath}`);

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
