const express = require('express');
const router = express.Router();
const { queries } = require('../db');

function isDevPremiumEnabled() {
    const flag = String(process.env.PREMIUM_DEV_UNLOCK || '').toLowerCase();
    return process.env.NODE_ENV !== 'production' && (flag === '1' || flag === 'true' || flag === 'yes');
}

function isPremiumUnlocked(proposal) {
    return proposal.payment_status === 'paid' || isDevPremiumEnabled();
}

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

    const premiumUnlocked = isPremiumUnlocked(proposal);
    const now = new Date();
    const unlockAt = proposal.reveal_at ? new Date(proposal.reveal_at) : null;
    const lockInfo = {
        locked: false,
        reason: null,
        unlockAt: null,
        passphraseRequired: false
    };

    if (premiumUnlocked) {
        lockInfo.unlockAt = unlockAt ? unlockAt.toISOString() : null;
        lockInfo.passphraseRequired = !!proposal.passphrase_hash;
        if (unlockAt && unlockAt > now) {
            lockInfo.locked = true;
            lockInfo.reason = 'time';
        } else if (proposal.passphrase_hash) {
            lockInfo.locked = true;
            lockInfo.reason = 'passphrase';
        }
    }

    if (!lockInfo.locked) {
        queries.markViewed.run(id);
    }

    // Parse content JSON
    const content = JSON.parse(proposal.content);

    res.render(`view/${proposal.persona}`, {
        proposal,
        content,
        lockInfo,
        premiumUnlocked
    });
});

// Success page (for creator to check status)
router.get('/success/:id', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);

    if (!proposal) {
        return res.status(404).render('error', { message: 'Proposal not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const baseLink = process.env.INTASEND_PAYMENT_LINK || '';
    let paymentLink = '';
    if (baseLink) {
        const params = new URLSearchParams();
        params.set('reference', proposal.unique_id);
        params.set('redirect_url', `${baseUrl}/success/${proposal.unique_id}?paid=1`);
        params.set('return_url', `${baseUrl}/success/${proposal.unique_id}?paid=1`);
        paymentLink = `${baseLink}${baseLink.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    res.render('success', {
        proposal,
        paymentLink,
        paymentStatus: proposal.payment_status || 'pending'
    });
});

// Printable keepsake card
router.get('/v/:id/keepsake', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);

    if (!proposal) {
        return res.status(404).render('error', { message: 'This keepsake is missing...' });
    }

    const premiumUnlocked = isPremiumUnlocked(proposal);
    if (!premiumUnlocked) {
        return res.status(403).render('error', { message: 'Premium keepsake is locked. Please unlock first.' });
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

    res.render('keepsake', { proposal, content, lockInfo, premiumUnlocked });
});

// Premium media proxy
router.get('/media/:id/audio', (req, res) => {
    const { id } = req.params;
    const proposal = queries.getByUniqueId.get(id);
    if (!proposal) {
        return res.status(404).send('Not found');
    }
    if (!isPremiumUnlocked(proposal)) {
        return res.status(403).send('Premium locked');
    }

    try {
        const content = JSON.parse(proposal.content);
        const url = content?.premium?.audioNote?.url;
        if (!url) {
            return res.status(404).send('Missing audio');
        }
        return res.redirect(url);
    } catch (err) {
        return res.status(500).send('Failed to load media');
    }
});

router.get('/media/:id/gift/:index', (req, res) => {
    const { id, index } = req.params;
    const proposal = queries.getByUniqueId.get(id);
    if (!proposal) {
        return res.status(404).send('Not found');
    }
    if (!isPremiumUnlocked(proposal)) {
        return res.status(403).send('Premium locked');
    }

    try {
        const content = JSON.parse(proposal.content);
        const images = content?.gift?.images || [];
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= images.length) {
            return res.status(404).send('Missing image');
        }
        return res.redirect(images[idx]);
    } catch (err) {
        return res.status(500).send('Failed to load media');
    }
});

module.exports = router;
