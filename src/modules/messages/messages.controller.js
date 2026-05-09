const { getUserConversations, getConversation, getMessages, sendMessage, startConversationWithSwap } = require('./messages.service');

const getConversationsController = async (req, res, next) => {
  try {
    const convs = await getUserConversations(req.user.id);
    res.json({ data: convs });
  } catch (err) { next(err); }
};

const getConversationController = async (req, res, next) => {
  try {
    const conv = await getConversation(req.params.id, req.user.id);
    res.json({ data: conv });
  } catch (err) { next(err); }
};

const getMessagesController = async (req, res, next) => {
  try {
    const messages = await getMessages(req.params.id, req.user.id, req.query.page, req.query.limit);
    res.json({ data: messages });
  } catch (err) { next(err); }
};

const sendMessageController = async (req, res, next) => {
  try {
    const msg = await sendMessage(req.params.id, req.user.id, req.body.content, req.body.msgType);
    res.status(201).json({ data: msg });
  } catch (err) { next(err); }
};

const startConversationController = async (req, res, next) => {
  try {
    const conv = await startConversationWithSwap(req.user.id, req.body.targetUserId, req.body.swapId);
    res.json({ data: conv });
  } catch (err) { next(err); }
};

module.exports = { getConversationsController, getConversationController, getMessagesController, sendMessageController, startConversationController };
