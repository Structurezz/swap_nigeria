const svc = require('./dispute.service');

const listRoomsController = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, stage } = req.query;
    const data = await svc.listRooms({ page: +page, limit: +limit, status, stage });
    res.json({ data });
  } catch (err) { next(err); }
};

const getRoomController = async (req, res, next) => {
  try {
    const data = await svc.getRoom(req.params.swapId);
    if (!data) return res.status(404).json({ error: 'Dispute room not found' });
    res.json({ data });
  } catch (err) { next(err); }
};

const openRoomController = async (req, res, next) => {
  try {
    const data = await svc.openRoom(req.params.swapId);
    res.json({ data });
  } catch (err) { next(err); }
};

const sendMessageController = async (req, res, next) => {
  try {
    const { content, messageType, attachmentUrl, attachmentFilename, attachmentIsPdf } = req.body;
    const attachmentMeta = attachmentUrl
      ? { url: attachmentUrl, filename: attachmentFilename || 'attachment', isPdf: Boolean(attachmentIsPdf) }
      : null;
    const data = await svc.sendMessage(req.params.roomId, req.user.id, content, messageType, attachmentMeta);
    res.json({ data });
  } catch (err) { next(err); }
};

const advanceStageController = async (req, res, next) => {
  try {
    const data = await svc.advanceStage(req.params.roomId, req.user.id);
    res.json({ data });
  } catch (err) { next(err); }
};

const issueRulingController = async (req, res, next) => {
  try {
    const data = await svc.issueRuling(req.params.roomId, req.user.id, req.body);
    res.json({ data });
  } catch (err) { next(err); }
};

// ── Legal counsel ──────────────────────────────────────────────────────────────
const findLawyersController = async (req, res, next) => {
  try {
    const { specialization, maxFeeKobo, page = 1, limit = 20 } = req.query;
    const data = await svc.findLawyers({ specialization, maxFeeKobo: maxFeeKobo ? +maxFeeKobo : undefined, page: +page, limit: +limit });
    res.json({ data });
  } catch (err) { next(err); }
};

const requestCounselController = async (req, res, next) => {
  try {
    const { counselId, proposedFeeKobo } = req.body;
    const data = await svc.requestCounsel(req.params.roomId, req.user.id, counselId, proposedFeeKobo);
    res.json({ data });
  } catch (err) { next(err); }
};

const respondCounselController = async (req, res, next) => {
  try {
    const { accept, agreedFeeKobo } = req.body;
    const data = await svc.respondToCounselRequest(
      req.params.roomId,
      req.user.id,
      req.params.requestId,
      Boolean(accept),
      agreedFeeKobo,
    );
    res.json({ data });
  } catch (err) { next(err); }
};

const uploadEvidenceController = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const data = await svc.uploadEvidence(req.params.roomId, req.user.id, req.file);
    res.json({ data });
  } catch (err) { next(err); }
};

module.exports = {
  listRoomsController,
  getRoomController,
  openRoomController,
  sendMessageController,
  advanceStageController,
  issueRulingController,
  findLawyersController,
  requestCounselController,
  respondCounselController,
  uploadEvidenceController,
};
