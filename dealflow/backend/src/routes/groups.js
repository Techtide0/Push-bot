const router = require('express').Router();
const ctrl = require('../controllers/groupController');

router.get('/available', ctrl.getAvailableGroups);
router.get('/selected', ctrl.getSelectedGroups);
router.post('/selected', ctrl.addGroup);
router.delete('/selected/:id', ctrl.removeGroup);

module.exports = router;
