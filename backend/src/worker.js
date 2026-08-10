require("dotenv").config();
const { Worker } = require("bullmq");
const sharp = require("sharp");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { connection, THUMBNAIL_QUEUE, MAINTENANCE_QUEUE, maintenanceQueue } = require("./queue");
const { s3, putObject, BUCKET } = require("./storage");
const pool = require("./db");
const { reconcileOwners, backfillMessageSenders } = require("./clerkUsers");

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

// ── Maintenance: periodically reconcile owner liveness against Clerk ──────────
const RECONCILE_EVERY_MS = Number(process.env.RECONCILE_INTERVAL_MS || 6 * 60 * 60 * 1000);

const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    if (job.name === "reconcile-owners") {
      const owners  = await reconcileOwners(pool);
      const senders = await backfillMessageSenders(pool);
      console.log("🧹 reconcile:", JSON.stringify({ owners, senders }));
      return { owners, senders };
    }
  },
  { connection }
);
maintenanceWorker.on("failed", (job, err) => console.error(`❌ maintenance job ${job?.id} failed:`, err?.message));

// Register the repeatable schedule (idempotent by repeat key) + run once on boot.
(async () => {
  try {
    await maintenanceQueue.add(
      "reconcile-owners", {},
      { repeat: { every: RECONCILE_EVERY_MS }, removeOnComplete: true, removeOnFail: 20 }
    );
    await maintenanceQueue.add("reconcile-owners", {}, { removeOnComplete: true });
    console.log(`🗓️  Owner reconcile scheduled every ${Math.round(RECONCILE_EVERY_MS / 60000)}m`);
  } catch (e) {
    console.error("Failed to schedule owner reconcile:", e.message);
  }
})();
