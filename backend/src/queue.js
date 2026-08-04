const { Queue } = require("bullmq");

// BullMQ requires maxRetriesPerRequest: null on the connection.
const connection = {
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
};

const THUMBNAIL_QUEUE = "thumbnail";
const MAINTENANCE_QUEUE = "maintenance";

const thumbnailQueue   = new Queue(THUMBNAIL_QUEUE, { connection });
const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });

module.exports = { thumbnailQueue, maintenanceQueue, connection, THUMBNAIL_QUEUE, MAINTENANCE_QUEUE };
