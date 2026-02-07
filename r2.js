/**
 * Cloudflare R2 Upload Module
 * 
 * Configure these in your .env:
 * R2_ACCOUNT_ID=your_cloudflare_account_id
 * R2_ACCESS_KEY_ID=your_r2_access_key
 * R2_SECRET_ACCESS_KEY=your_r2_secret_key
 * R2_BUCKET_NAME=valentines
 * R2_PUBLIC_URL=https://your-bucket.your-domain.com
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');

// Check if R2 is configured
const isR2Configured = () => {
    return process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY;
};

// Initialize S3 client for R2
let s3Client = null;
if (isR2Configured()) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
}

// Multer memory storage for processing before upload
const storage = multer.memoryStorage();

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only images allowed (JPEG, PNG, WebP, GIF)'), false);
    }
};

// Multer upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 3 // Max 3 files
    }
});

/**
 * Upload a file to R2
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File mimetype
 * @param {string} proposalId - Proposal unique ID (used as folder)
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadToR2(buffer, filename, mimetype, proposalId) {
    if (!isR2Configured()) {
        throw new Error('R2 is not configured');
    }

    const ext = path.extname(filename);
    const key = `proposals/${proposalId}/${Date.now()}${ext}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
    }));

    // Return public URL
    return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from R2
 * @param {string} url - Full URL of the file
 */
async function deleteFromR2(url) {
    if (!isR2Configured()) return;

    const key = url.replace(`${process.env.R2_PUBLIC_URL}/`, '');

    await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
    }));
}

module.exports = {
    upload,
    uploadToR2,
    deleteFromR2,
    isR2Configured
};
