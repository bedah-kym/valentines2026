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
        let passphraseSalt = null;
        if (passphrase && String(passphrase).trim()) {
            passphraseSalt = crypto.randomBytes(16).toString('hex');
            passphraseHash = crypto.pbkdf2Sync(
                String(passphrase).trim(),
                passphraseSalt,
                120000,
                32,
                'sha256'
            ).toString('hex');
        }

        queries.create.run({
            unique_id,
            persona,
            sender_name: sender_name.trim(),
            recipient_name: recipient_name.trim(),
            content: typeof content === 'string' ? content : JSON.stringify(content),
            reveal_at: revealAt,
            passphrase_hash: passphraseHash,
            passphrase_salt: passphraseSalt
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
            const trimmed = passphrase.trim();
            if (proposal.passphrase_salt) {
                const hashed = crypto.pbkdf2Sync(
                    trimmed,
                    proposal.passphrase_salt,
                    120000,
                    32,
                    'sha256'
                ).toString('hex');
                if (hashed !== proposal.passphrase_hash) {
                    return res.status(401).json({ error: 'Incorrect passphrase' });
                }
            } else {
                // Legacy SHA-256 for existing records without salt.
                const hashed = crypto.createHash('sha256').update(trimmed).digest('hex');
                if (hashed !== proposal.passphrase_hash) {
                    return res.status(401).json({ error: 'Incorrect passphrase' });
                }
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
                    reveal_at: proposal.reveal_at,
                    payment_status: proposal.payment_status
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

function extractReference(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.reference ||
        payload.client_reference ||
        payload.invoice_id ||
        (payload.data && (payload.data.reference || payload.data.client_reference || payload.data.invoice_id)) ||
        null;
}

function extractStatus(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.status ||
        payload.state ||
        payload.payment_status ||
        (payload.data && (payload.data.status || payload.data.state || payload.data.payment_status)) ||
        null;
}

function extractAmount(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.value ||
        payload.amount ||
        payload.net_amount ||
        (payload.data && (payload.data.value || payload.data.amount || payload.data.net_amount)) ||
        null;
}

function extractCurrency(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.currency ||
        (payload.data && payload.data.currency) ||
        null;
}

function extractApiRef(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.api_ref ||
        (payload.data && payload.data.api_ref) ||
        null;
}

function asNumber(val) {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
}

// Payment webhook (IntaSend)
router.post('/payment-webhook', (req, res) => {
    try {
        const expectedChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
        if (!expectedChallenge) {
            return res.status(500).json({ error: 'Webhook challenge not configured' });
        }
        const challenge = req.body && (req.body.challenge || req.body.webhook_challenge);
        if (!challenge || String(challenge) !== String(expectedChallenge)) {
            return res.status(401).json({ error: 'Invalid challenge' });
        }

        const reference = extractReference(req.body);
        const status = extractStatus(req.body);
        if (!reference) {
            return res.status(400).json({ error: 'Missing payment reference' });
        }

        const expectedAmount = asNumber(process.env.INTASEND_EXPECTED_AMOUNT);
        const expectedCurrency = process.env.INTASEND_EXPECTED_CURRENCY || 'KES';
        const expectedApiRef = process.env.INTASEND_EXPECTED_API_REF;

        const amount = asNumber(extractAmount(req.body));
        const currency = extractCurrency(req.body);
        const apiRef = extractApiRef(req.body);

        if (expectedAmount !== null) {
            if (amount === null) {
                return res.status(400).json({ error: 'Missing amount' });
            }
            // Allow for gateway fees (treat amount >= expected as acceptable)
            if (amount + 0.0001 < expectedAmount) {
                return res.status(400).json({ error: 'Amount mismatch' });
            }
        }
        if (expectedCurrency) {
            if (!currency) {
                return res.status(400).json({ error: 'Missing currency' });
            }
            if (String(currency).toUpperCase() !== String(expectedCurrency).toUpperCase()) {
                return res.status(400).json({ error: 'Currency mismatch' });
            }
        }
        if (expectedApiRef) {
            if (!apiRef) {
                return res.status(400).json({ error: 'Missing api_ref' });
            }
            if (String(apiRef) !== String(expectedApiRef)) {
                return res.status(400).json({ error: 'Payment link mismatch' });
            }
        }

        const normalizedStatus = String(status || '').toLowerCase();
        const isPaid = ['paid', 'success', 'successful', 'complete', 'completed'].includes(normalizedStatus);
        const paymentStatus = isPaid ? 'paid' : (normalizedStatus || 'pending');
        const paidAt = isPaid ? new Date().toISOString() : null;

        queries.updatePayment.run(
            paymentStatus,
            paidAt,
            req.body.invoice_id || req.body.id || reference,
            req.body.provider || 'intasend',
            reference
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Payment webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Payment status (polling)
router.get('/payment-status/:id', (req, res) => {
    try {
        const { id } = req.params;
        const proposal = queries.getByUniqueId.get(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        res.json({
            payment_status: proposal.payment_status || 'pending',
            paid_at: proposal.paid_at || null
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ error: 'Failed to fetch payment status' });
    }
});

module.exports = router;
