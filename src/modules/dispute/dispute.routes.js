const router = require('express').Router();
const { auth, adminOnly } = require('../../middleware/auth');
const { uploadSingle } = require('../../utils/upload');
const c = require('./dispute.controller');

// ── Room management ────────────────────────────────────────────────────────────
router.get('/',                        auth, adminOnly, c.listRoomsController);
router.post('/:swapId/open',           auth, adminOnly, c.openRoomController);
router.get('/swap/:swapId',            auth, c.getRoomController);
router.post('/room/:roomId/message',   auth, c.sendMessageController);
router.patch('/room/:roomId/advance',  auth, adminOnly, c.advanceStageController);
router.post('/room/:roomId/ruling',    auth, adminOnly, c.issueRulingController);

// ── File attachments ──────────────────────────────────────────────────────────
// POST /dispute/room/:roomId/upload  — upload evidence file (image/PDF)
router.post('/room/:roomId/upload', auth, uploadSingle('file'), c.uploadEvidenceController);

// ── Legal counsel ──────────────────────────────────────────────────────────────
// GET  /dispute/lawyers                       — browse legal practitioners
// POST /dispute/room/:roomId/counsel          — party requests a lawyer
// PUT  /dispute/room/:roomId/counsel/:id      — lawyer accepts or declines
router.get('/lawyers',                        auth, c.findLawyersController);
router.post('/room/:roomId/counsel',          auth, c.requestCounselController);
router.put('/room/:roomId/counsel/:requestId',auth, c.respondCounselController);

module.exports = router;
