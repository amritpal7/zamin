const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Legacy on-disk dir — kept only so any previously-uploaded local files
// keep serving via /uploads. New uploads go to object storage.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Memory storage → we get buffers to resize with sharp and push to S3/MinIO.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per image
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

module.exports = { upload, UPLOAD_DIR };
