const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ENDPOINT        = process.env.S3_ENDPOINT || "http://minio:9000";
// Endpoint the CLIENT can reach (for presigned URLs). In prod this is the real
// S3/R2 public endpoint; in dev it's the host that proxies to MinIO.
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || "http://localhost";
const BUCKET          = process.env.S3_BUCKET || "zamin";
const PUBLIC_BASE     = process.env.S3_PUBLIC_BASE || "/media";

const credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY || "zamin_minio",
  secretAccessKey: process.env.S3_SECRET_KEY || "zamin_minio_secret",
};

// Internal client — used by the API/worker to talk to MinIO directly.
const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials,
});

// Public-facing client — only used to SIGN presigned URLs the client will hit.
const s3Public = new S3Client({
  endpoint: PUBLIC_ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials,
});

// Short-lived signed PUT URL the client uses to upload straight to storage.
// Content-Type is intentionally not signed → client can send any.
async function presignPut(key, expiresIn = 600) {
  return getSignedUrl(s3Public, new PutObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

// Create the bucket if missing and make objects publicly readable
// (so they can be served through nginx without signed URLs).
async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  const policy = {
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    }],
  };
  await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }));
}

// Stores a buffer and returns the public (nginx-relative) URL.
async function putObject(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${PUBLIC_BASE}/${key}`;
}

module.exports = { s3, ensureBucket, putObject, presignPut, BUCKET, PUBLIC_BASE };
