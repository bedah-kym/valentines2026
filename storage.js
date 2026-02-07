const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');

// Check if S3 is configured
const isStorageConfigured = () => {
    return process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION &&
        process.env.AWS_BUCKET_NAME;
};

// Initialize S3 client
let s3Client = null;

try {
    if (isStorageConfigured()) {
        const config = {
            region: process.env.AWS_REGION || 'auto',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        };

        // Add endpoint for Cloudflare R2 or other S3-compat services
        if (process.env.AWS_ENDPOINT) {
            console.log('Using Custom Endpoint:', process.env.AWS_ENDPOINT);
            config.endpoint = process.env.AWS_ENDPOINT;
        }

        s3Client = new S3Client(config);
        console.log('S3 Client initialized successfully');
    } else {
        console.log('Storage configuration missing. Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME');
    }
} catch (err) {
    console.error('Error initializing S3 Client:', err);
}

// Multer memory storage
const storage = multer.memoryStorage();

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only images or short audio notes allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
    }
});

/**
 * Upload to S3
 */
async function uploadToStorage(buffer, filename, mimetype, proposalId) {
    if (!isStorageConfigured() || !s3Client) {
        throw new Error('Storage not configured or S3Client init failed');
    }

    const ext = path.extname(filename);
    const key = `proposals/${proposalId}/${Date.now()}${ext}`;

    try {
        console.log(`Sending PutObject to bucket: ${process.env.AWS_BUCKET_NAME}, Key: ${key}`);

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            // Add ACL if bucket is public, otherwise access via CloudFront or S3 URL if public
            // ACL: 'public-read' 
        }));

        console.log('PutObject successful');

        // Return public URL
        // If a custom public URL (CNAME/CloudFront) is set, use it
        if (process.env.AWS_PUBLIC_URL) {
            return `${process.env.AWS_PUBLIC_URL}/${key}`;
        }

        // If using R2, standard S3 URL might not work unless R2.dev subdomain is enabled
        // Construct R2 public URL if usage pattern matches
        if (process.env.AWS_ENDPOINT && process.env.AWS_ENDPOINT.includes('r2.cloudflarestorage.com')) {
            // Best effort guess for R2 public dev URL if not specified
            // But usually R2 needs AWS_PUBLIC_URL set
            return `${process.env.AWS_ENDPOINT.replace('https://', 'https://pub-')}/${key}`;
            // Note: The above is a guess, user really should set AWS_PUBLIC_URL for R2
        }

        // Fallback for standard S3
        return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (err) {
        console.error('S3 Upload Error Details:', {
            message: err.message,
            code: err.Code,
            requestId: err.RequestId,
            httpStatusCode: err.$metadata?.httpStatusCode
        });
        throw err;
    }
}

module.exports = {
    upload,
    uploadToStorage,
    isStorageConfigured
};
