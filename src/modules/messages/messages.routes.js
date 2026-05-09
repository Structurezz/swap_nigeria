const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const {
  getConversationsController, getConversationController,
  getMessagesController, sendMessageController, startConversationController,
} = require('./messages.controller');

router.get('/conversations', auth, getConversationsController);
router.post('/conversations', auth, startConversationController);
router.get('/conversations/:id', auth, getConversationController);
router.get('/conversations/:id/messages', auth, getMessagesController);
router.post('/conversations/:id/messages', auth, sendMessageController);

module.exports = router;
