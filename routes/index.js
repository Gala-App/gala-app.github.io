const express = require('express');
const path = require('path');
const router = express.Router();

// Home
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs', 'index.html'));
});

// Talent profile deep link fallback — shown when user doesn't have the app installed
router.get('/view-talent/:talentId', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs', 'view-talent.html'));
});

module.exports = router;