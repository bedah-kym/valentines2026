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

    // Mark as viewed
    queries.markViewed.run(id);

    // Parse content JSON
    const content = JSON.parse(proposal.content);

    res.render(`view/${proposal.persona}`, {
        proposal,
        content
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

module.exports = router;
