const express = require('express');
const router = express.Router();
const { queries } = require('../db');

// Landing page
router.get('/', (req, res) => {
    res.render('index');
});

// Create form for specific persona
router.get('/create/:persona', (req, res) => {
    const { persona } = req.params;
    const validPersonas = ['fortune', 'achievement', 'letter'];

    if (!validPersonas.includes(persona)) {
        return res.status(404).render('error', { message: 'Persona not found' });
    }

    res.render(`create/${persona}`, { persona });
});

// View proposal (recipient experience)
router.get('/v/:id', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);

    if (!proposal) {
        return res.status(404).render('error', { message: 'This love letter has floated away...' });
    }

    const now = new Date();
    const unlockAt = proposal.reveal_at ? new Date(proposal.reveal_at) : null;
    const lockInfo = {
        locked: false,
        reason: null,
        unlockAt: unlockAt ? unlockAt.toISOString() : null,
        passphraseRequired: !!proposal.passphrase_hash
    };

    if (unlockAt && unlockAt > now) {
        lockInfo.locked = true;
        lockInfo.reason = 'time';
    } else if (proposal.passphrase_hash) {
        lockInfo.locked = true;
        lockInfo.reason = 'passphrase';
    }

    if (!lockInfo.locked) {
        queries.markViewed.run(id);
    }

    // Parse content JSON
    const content = JSON.parse(proposal.content);

    res.render(`view/${proposal.persona}`, {
        proposal,
        content,
        lockInfo
    });
});

// Success page (for creator to check status)
router.get('/success/:id', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);

    if (!proposal) {
        return res.status(404).render('error', { message: 'Proposal not found' });
    }

    res.render('success', { proposal });
});

// Printable keepsake card
router.get('/v/:id/keepsake', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);

    if (!proposal) {
        return res.status(404).render('error', { message: 'This keepsake is missing...' });
    }

    const now = new Date();
    const unlockAt = proposal.reveal_at ? new Date(proposal.reveal_at) : null;
    const lockInfo = {
        locked: false,
        reason: null,
        unlockAt: unlockAt ? unlockAt.toISOString() : null,
        passphraseRequired: !!proposal.passphrase_hash
    };

    if (unlockAt && unlockAt > now) {
        lockInfo.locked = true;
        lockInfo.reason = 'time';
    } else if (proposal.passphrase_hash) {
        lockInfo.locked = true;
        lockInfo.reason = 'passphrase';
    }

    const content = JSON.parse(proposal.content);

    res.render('keepsake', { proposal, content, lockInfo });
});

module.exports = router;
