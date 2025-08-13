const express = require('express');
const ChatSession = require('../models/History');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all chat sessions for a user
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user.userId })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

// Get messages for a specific chat session
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ 
      _id: req.params.sessionId, 
      userId: req.user.userId 
    }).lean();
    
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.json({ messages: session.messages || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session messages' });
  }
});

// Create a new chat session
router.post('/session', auth, async (req, res) => {
  try {
    const { title, messages } = req.body;
    const session = new ChatSession({
      userId: req.user.userId,
      title: title || 'New Chat',
      messages: messages || []
    });
    await session.save();
    res.json({ sessionId: session._id, session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Add a message to a chat session
router.post('/session/:sessionId/message', auth, async (req, res) => {
  try {
    const { role, text } = req.body;
    const session = await ChatSession.findOne({ 
      _id: req.params.sessionId, 
      userId: req.user.userId 
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    session.messages.push({ role, text });
    
    // Update title if this is the first user message
    if (session.messages.length === 1 && role === 'user') {
      session.title = text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    
    await session.save();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Update a chat session title
router.put('/session/:sessionId/title', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const session = await ChatSession.findOneAndUpdate(
      { _id: req.params.sessionId, userId: req.user.userId },
      { title },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// Delete a chat session
router.delete('/session/:sessionId', auth, async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({ 
      _id: req.params.sessionId, 
      userId: req.user.userId 
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Legacy endpoint for backward compatibility
router.get('/history', auth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ messages: session ? session.messages : [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Legacy endpoint for backward compatibility
router.post('/message', auth, async (req, res) => {
  try {
    const { text, role } = req.body;
    let session = await ChatSession.findOne({ userId: req.user.userId })
      .sort({ updatedAt: -1 });
    
    if (!session) {
      session = new ChatSession({ 
        userId: req.user.userId, 
        title: 'New Chat',
        messages: [] 
      });
    }
    
    session.messages.push({ role, text });
    await session.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

module.exports = router;