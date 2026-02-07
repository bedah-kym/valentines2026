const express = require('express');
const router = express.Router();
const { queries } = require('../db');

// Generate short unique ID
async function generateId() {
    const { nanoid } = await import('nanoid');
    return nanoid(10);
}

// Create new proposal
router.post('/create', async (req, res) => {
    try {
        const { persona, sender_name, recipient_name, content } = req.body;

        // Validate
        if (!persona || !sender_name || !recipient_name || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const validPersonas = ['fortune', 'achievement', 'letter'];
        if (!validPersonas.includes(persona)) {
            return res.status(400).json({ error: 'Invalid persona' });
        }

        const unique_id = await generateId();

        queries.create.run({
            unique_id,
            persona,
            sender_name: sender_name.trim(),
            recipient_name: recipient_name.trim(),
            content: typeof content === 'string' ? content : JSON.stringify(content)
        });

        res.json({
            success: true,
            unique_id,
            shareUrl: `/v/${unique_id}`,
            statusUrl: `/success/${unique_id}`
        });
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: 'Failed to create proposal' });
    }
});

// Respond to proposal (accept/reject)
router.post('/respond/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const proposal = queries.getByUniqueId.get(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        queries.updateStatus.run(status, id);

        res.json({ success: true, status });
    } catch (error) {
        console.error('Respond error:', error);
        res.status(500).json({ error: 'Failed to update response' });
    }
});

// Upload images for a proposal (before final creation)
const { upload, uploadToR2, isR2Configured } = require('../r2');

router.post('/upload', upload.array('images', 3), async (req, res) => {
    try {
        if (!isR2Configured()) {
            return res.status(400).json({ error: 'Image uploads not configured' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        // Generate a temporary ID for this upload session
        const { nanoid } = await import('nanoid');
        const uploadSessionId = nanoid(10);

        const urls = [];
        for (const file of req.files) {
            const url = await uploadToR2(
                file.buffer,
                file.originalname,
                file.mimetype,
                uploadSessionId
            );
            urls.push(url);
        }

        res.json({
            success: true,
            sessionId: uploadSessionId,
            urls
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// Check if R2 is configured
router.get('/config', (req, res) => {
    res.json({
        imageUploads: isR2Configured()
    });
});

module.exports = router;
