const router = require('express').Router();
const { broadcast } = require('../controllers/broadcastController');

router.post('/', broadcast);

module.exports = router;
