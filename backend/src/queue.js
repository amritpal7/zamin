const { Queue } = require("bullmq");

// BullMQ requires maxRetriesPerRequest: null on the connection.
const { redisOptions } = require("./redisConfig");
const connection = redisOptions({ maxRetriesPerRequest: null });

const THUMBNAIL_QUEUE = "thumbnail";
const MAINTENANCE_QUEUE = "maintenance";

const thumbnailQueue   = new Queue(THUMBNAIL_QUEUE, { connection });
const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });

module.exports = { thumbnailQueue, maintenanceQueue, connection, THUMBNAIL_QUEUE, MAINTENANCE_QUEUE };
