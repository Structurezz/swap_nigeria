const router = require('express').Router();
const { auth, adminOnly } = require('../../middleware/auth');
const c = require('./dispute.controller');

router.get('/',                        auth, adminOnly, c.listRoomsController);
router.post('/:swapId/open',           auth, adminOnly, c.openRoomController);
router.get('/swap/:swapId',            auth, c.getRoomController);
router.post('/room/:roomId/message',   auth, c.sendMessageController);
router.patch('/room/:roomId/advance',  auth, adminOnly, c.advanceStageController);
router.post('/room/:roomId/ruling',    auth, adminOnly, c.issueRulingController);

module.exports = router;
