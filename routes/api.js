const express = require('express');
const router = express.Router();
const { queries } = require('../db');
const crypto = require('crypto');

// Generate short unique ID
async function generateId() {
    const { nanoid } = await import('nanoid');
    return nanoid(10);
}

// Create new proposal
router.post('/create', async (req, res) => {
    try {
        const { persona, sender_name, recipient_name, content, reveal_at, passphrase } = req.body;

        // Validate
        if (!persona || !sender_name || !recipient_name || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const validPersonas = ['fortune', 'achievement', 'letter'];
        if (!validPersonas.includes(persona)) {
            return res.status(400).json({ error: 'Invalid persona' });
        }

        const unique_id = await generateId();

        let revealAt = null;
        if (reveal_at) {
            const parsed = new Date(reveal_at);
            if (isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'Invalid reveal time' });
            }
            revealAt = parsed.toISOString();
        }

        let passphraseHash = null;
        if (passphrase && String(passphrase).trim()) {
            passphraseHash = crypto.createHash('sha256').update(String(passphrase).trim()).digest('hex');
        }

        queries.create.run({
            unique_id,
            persona,
            sender_name: sender_name.trim(),
            recipient_name: recipient_name.trim(),
            content: typeof content === 'string' ? content : JSON.stringify(content),
            reveal_at: revealAt,
            passphrase_hash: passphraseHash
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
        const { status, note } = req.body;

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const proposal = queries.getByUniqueId.get(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        queries.updateStatus.run(status, note || null, id);

        res.json({ success: true, status });
    } catch (error) {
        console.error('Respond error:', error);
        res.status(500).json({ error: 'Failed to update response' });
    }
});

// Unlock protected proposal (passphrase/time-gate)
router.post('/unlock/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { passphrase } = req.body;

        const proposal = queries.getByUniqueId.get(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        if (proposal.reveal_at) {
            const now = new Date();
            const unlockAt = new Date(proposal.reveal_at);
            if (unlockAt > now) {
                return res.status(403).json({ error: 'Time-locked', unlockAt });
            }
        }

        if (proposal.passphrase_hash) {
            if (!passphrase || typeof passphrase !== 'string') {
                return res.status(400).json({ error: 'Passphrase required' });
            }
            const hashed = crypto.createHash('sha256').update(passphrase.trim()).digest('hex');
            if (hashed !== proposal.passphrase_hash) {
                return res.status(401).json({ error: 'Incorrect passphrase' });
            }
        }

        queries.markViewed.run(id);
        return res.json({ success: true });
    } catch (error) {
        console.error('Unlock error:', error);
        res.status(500).json({ error: 'Failed to unlock proposal' });
    }
});

// Mark as viewed (used after countdown unlock)
router.post('/mark-viewed/:id', (req, res) => {
    try {
        const { id } = req.params;
        queries.markViewed.run(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Mark viewed error:', error);
        res.status(500).json({ error: 'Failed to mark viewed' });
    }
});

// Get status for multiple proposals (My Proposals Dashboard)
router.post('/my-proposals', (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'ids must be an array' });
        }

        const results = [];
        // Loop through IDs and fetch status (keeping it simple)
        for (const id of ids) {
            const proposal = queries.getByUniqueId.get(id);
            if (proposal) {
                results.push({
                    unique_id: proposal.unique_id,
                    sender_name: proposal.sender_name,
                    recipient_name: proposal.recipient_name,
                    persona: proposal.persona,
                    status: proposal.status,
                    response_note: proposal.response_note, // Include the note!
                    viewed_at: proposal.viewed_at,
                    created_at: proposal.created_at,
                    reveal_at: proposal.reveal_at
                });
            }
        }

        res.json({ proposals: results });
    } catch (error) {
        console.error('My Proposals error:', error);
        res.status(500).json({ error: 'Failed to fetch proposals' });
    }
});

// Upload images/audio for a proposal (before final creation)
const { upload, uploadToStorage, isStorageConfigured } = require('../storage');
const fs = require('fs');
const path = require('path');

router.post('/upload', (req, res, next) => {
    // Custom wrapper to catch multer errors
    upload.any()(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!isStorageConfigured()) {
            const configStatus = {
                hasKey: !!process.env.AWS_ACCESS_KEY_ID,
                hasSecret: !!process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION,
                bucket: process.env.AWS_BUCKET_NAME,
                endpoint: process.env.AWS_ENDPOINT
            };
            console.error('Storage NOT configured. Env vars:', configStatus);

            // Log to file for debugging
            try {
                fs.appendFileSync(
                    path.join(__dirname, '../config_errors.log'),
                    `[${new Date().toISOString()}] Config missing: ${JSON.stringify(configStatus)}\n`
                );
            } catch (e) { }

            return res.status(400).json({ error: 'Image uploads not configured on server' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        console.log(`Processing ${req.files.length} files...`);

        // Generate a temporary ID for this upload session
        const { nanoid } = await import('nanoid');
        const uploadSessionId = nanoid(10);

        const urls = [];
        for (const file of req.files) {
            try {
                const url = await uploadToStorage(
                    file.buffer,
                    file.originalname,
                    file.mimetype,
                    uploadSessionId
                );
                console.log('Upload success:', url);
                urls.push(url);
            } catch (innerErr) {
                console.error('Individual file upload failed:', innerErr);
                throw innerErr;
            }
        }

        res.json({
            success: true,
            sessionId: uploadSessionId,
            urls
        });
    } catch (error) {
        console.error('Upload route error:', error);
        // Log to file for easier debugging
        try {
            fs.appendFileSync(
                path.join(__dirname, '../upload_errors.log'),
                `[${new Date().toISOString()}] ${error.stack}\n`
            );
        } catch (e) { }

        res.status(500).json({ error: 'Failed to upload images: ' + error.message });
    }
});

// Check if Storage is configured
router.get('/config', (req, res) => {
    res.json({
        imageUploads: isStorageConfigured()
    });
});

module.exports = router;
