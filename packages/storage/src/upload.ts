import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, R2_BUCKET } from "./client";

// Convención de paths: integration-files/{tenantId}/{integrationId}/{timestamp}_{filename}
export function buildStoragePath(
  tenantId: string,
  integrationId: number,
  filename: string
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${tenantId}/${integrationId}/${ts}_${safe}`;
}

// Genera una URL pre-firmada para que el browser suba directamente a R2 (PUT)
export async function getUploadPresignedUrl(
  storagePath: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET(),
    Key: storagePath,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// Genera una URL pre-firmada para descarga (GET) — usada por el worker
export async function getDownloadPresignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET(),
    Key: storagePath,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// Descarga el contenido como Buffer — el worker lo usa para parsear sin guardar en disco
export async function downloadFileBuffer(storagePath: string): Promise<Buffer> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET(),
    Key: storagePath,
  });
  const response = await client.send(command);
  if (!response.Body) throw new Error(`Empty response from R2: ${storagePath}`);

  // Body es un ReadableStream en Node — convertir a Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Elimina un archivo del bucket (para cleanup post-procesamiento si se decide)
export async function deleteFile(storagePath: string): Promise<void> {
  const client = createR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: storagePath }));
}
