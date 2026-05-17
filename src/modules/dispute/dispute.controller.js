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
    const { content, messageType } = req.body;
    const data = await svc.sendMessage(req.params.roomId, req.user.id, content, messageType);
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

module.exports = {
  listRoomsController,
  getRoomController,
  openRoomController,
  sendMessageController,
  advanceStageController,
  issueRulingController,
};
