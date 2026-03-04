const express = require('express');
const router = express.Router();
const config = require('../config');

// Получить структуру рабочего пространства
router.get('/workspace', (req, res) => {
    res.json(config.WORKSPACE_STRUCTURE);
});

module.exports = router;
