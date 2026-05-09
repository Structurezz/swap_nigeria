const multer = require('multer');
const mongoose = require('mongoose');
const { Readable } = require('stream');

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

// Keep files in memory; we write to GridFS manually after validation
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/**
 * Write a buffer to MongoDB GridFS.
 * Returns the file ObjectId as a string.
 */
const uploadToGridFS = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });

    const uniqueName = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;
    const stream = bucket.openUploadStream(uniqueName, { contentType: mimetype });

    const readable = Readable.from(buffer);
    readable.pipe(stream);

    stream.on('finish', () => resolve(stream.id.toString()));
    stream.on('error', reject);
  });
};

/** Build the public URL path for a stored file. */
const fileUrl = (fileId) => `/api/files/${fileId}`;

/** Multer middleware — single file */
const uploadSingle = (fieldName) => upload.single(fieldName);

/** Multer middleware — multiple files */
const uploadMultiple = (fieldName, maxCount) => upload.array(fieldName, maxCount);

module.exports = { uploadSingle, uploadMultiple, uploadToGridFS, fileUrl };
