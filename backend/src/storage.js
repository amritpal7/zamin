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
// Raw uploads (<base>_orig) can go to a separate PRIVATE bucket. Needed on R2, where public access
// is per-bucket (no policy to hide *_orig) — raw photos may still carry EXIF/GPS. Dev: same bucket.
const UPLOAD_BUCKET   = process.env.S3_UPLOAD_BUCKET || BUCKET;
const PUBLIC_BASE     = process.env.S3_PUBLIC_BASE || "/media";
// "us-east-1" for MinIO/AWS defaults; Cloudflare R2 uses "auto".
const REGION          = process.env.S3_REGION || "us-east-1";

const credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY || "zamin_minio",
  secretAccessKey: process.env.S3_SECRET_KEY || "zamin_minio_secret",
};

// Internal client — used by the API/worker to talk to MinIO directly.
// Only compute/validate checksums when an operation requires it: newer SDKs otherwise embed
// `x-amz-checksum-crc32=<empty-body CRC>` into presigned PUTs, which R2/S3 can reject.
const CHECKSUMS = { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" };

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials,
  ...CHECKSUMS,
});

// Public-facing client — only used to SIGN presigned URLs the client will hit.
const s3Public = new S3Client({
  endpoint: PUBLIC_ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials,
  ...CHECKSUMS,
});

// Short-lived signed PUT URL the client uses to upload straight to storage.
// Content-Type is intentionally not signed → client can send any.
async function presignPut(key, expiresIn = 600) {
  return getSignedUrl(s3Public, new PutObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key }), { expiresIn });
}

// Create the bucket if missing and make objects publicly readable
// (so they can be served through nginx without signed URLs).
async function ensureBucket() {
  for (const b of new Set([BUCKET, UPLOAD_BUCKET])) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: b }));
    } catch {
      // Managed stores (R2/S3) are usually pre-created and the key may lack create rights.
      try { await s3.send(new CreateBucketCommand({ Bucket: b })); }
      catch (e) { console.error(`Bucket ${b} missing and could not be created:`, e.message); }
    }
  }
  const policy = {
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      // Only processed images (*.jpg) are public. Raw uploads (<base>_orig, no extension) may
      // still carry EXIF/GPS and must not be readable by URL while they await processing.
      Resource: [`arn:aws:s3:::${BUCKET}/*.jpg`],
    }],
  };
  try {
    await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }));
  } catch (e) {
    // R2 has no bucket policies: public access is a per-bucket dashboard setting instead —
    // make ONLY the processed bucket public and keep S3_UPLOAD_BUCKET private.
    console.warn("Bucket policy not applied (expected on Cloudflare R2):", e.message);
  }
}

// Raw upload into the (private) upload bucket — legacy multipart path.
async function putUpload(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

// Stores a buffer and returns the public (nginx-relative) URL.
async function putObject(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${PUBLIC_BASE}/${key}`;
}

module.exports = { s3, ensureBucket, putObject, putUpload, presignPut, BUCKET, UPLOAD_BUCKET, PUBLIC_BASE };
