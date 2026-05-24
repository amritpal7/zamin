require("dotenv").config();
const { Worker } = require("bullmq");
const sharp = require("sharp");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { connection, THUMBNAIL_QUEUE } = require("./queue");
const { s3, putObject, BUCKET } = require("./storage");

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Consumes thumbnail jobs: fetch the raw original, produce an optimized
// full image + a small thumbnail, store both at predictable keys, drop the original.
const worker = new Worker(
  THUMBNAIL_QUEUE,
  async (job) => {
    const { origKey, base } = job.data;

    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: origKey }));
    const buf = await streamToBuffer(obj.Body);

    const full = await sharp(buf).rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer();
    const thumb = await sharp(buf).rotate()
      .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 }).toBuffer();

    await putObject(`${base}.jpg`, full, "image/jpeg");
    await putObject(`${base}_thumb.jpg`, thumb, "image/jpeg");

    // Best-effort cleanup of the raw original
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: origKey }));
    } catch { /* leave the original if delete fails */ }

    return { base };
  },
  { connection, concurrency: 4 }
);

worker.on("completed", (job) => console.log(`✅ thumbnail job ${job.id} done (${job.data.base})`));
worker.on("failed", (job, err) => console.error(`❌ thumbnail job ${job?.id} failed:`, err?.message));

console.log("🖼️  Thumbnail worker started, waiting for jobs…");
