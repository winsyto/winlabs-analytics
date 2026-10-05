import { S3Client } from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// R2 es S3-compatible. El endpoint tiene el formato:
// https://<account_id>.r2.cloudflarestorage.com
export function createR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export const R2_BUCKET = (): string => {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing required env var: R2_BUCKET");
  return bucket;
};
