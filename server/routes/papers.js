const express = require('express');
const Paper = require('../models/Paper.js');
const { fetchArxivPapers } = require('../services/arxiv.js');
const { summarizeText, compareSummaries } = require('../services/cohere.js');
const auth = require('../middleware/auth');
const router = express.Router();
const ChatSession = require('../models/History.js');

// Helper to fetch and summarize papers sequentially
async function saveChatMessages(userId, userText, botText) {
  let session = await ChatSession.findOne({ userId })
    .sort({ updatedAt: -1 });
  
  if (!session) {
    session = new ChatSession({ 
      userId, 
      title: userText.length > 50 ? userText.substring(0, 50) + '...' : userText,
      messages: [] 
    });
  }
  
  console.log(userText, botText)
  session.messages.push({ role: 'user', text: userText });
  session.messages.push({ role: 'bot', text: botText });
  await session.save();
}

// Helper: sequential summarization
async function summarizePapersSequential(papers) {
  const results = [];
  for (const p of papers) {
    try {
      if (p.aiSummary && p.aiSummaryAt && (new Date() - new Date(p.aiSummaryAt) < 1000 * 60 * 60 * 24)) {
        results.push(p);
        continue;
      }

      const textToSummarize = p.rawSummary || p.summary || '';
      if (!textToSummarize || textToSummarize.trim().length === 0) {
        results.push(p);
        continue;
      }

      const aiSummary = await summarizeText(textToSummarize);

      p.aiSummary = aiSummary;
      p.aiSummaryAt = new Date();
      results.push(p);
    } catch (err) {
      console.error('Summarize error for:', p.title, err.message || err);
      results.push(p);
    }
  }
  return results;
}

/**
 * GET /api/papers/fetch?topic=xxx&maxResults=3
 * Just fetches ARXIV results (no summarization)
 */
router.get('/fetch', async (req, res) => {
  try {
    const topic = req.query.topic;
    const maxResults = parseInt(req.query.maxResults || process.env.DEFAULT_MAX_RESULTS || 3, 10);
    if (!topic) return res.status(400).json({ error: 'topic query param required' });

    const papers = await fetchArxivPapers(topic, maxResults);
    return res.json({ papers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed fetching papers' });
  }
});

/**
 * POST /api/papers/search
 * body: { topic: string, maxResults?: number, summarize?: boolean }
 * Fetches, optionally summarizes (via Gemini), stores in Mongo (upsert)
 */
router.post('/search', auth, async (req, res) => {
  try {
    const topic = req.body.topic;
    const maxResults = parseInt(req.body.maxResults || process.env.DEFAULT_MAX_RESULTS || 3, 10);
    const summarize = (req.body.summarize === undefined) ? true : !!req.body.summarize;

    if (!topic) return res.status(400).json({ error: 'topic is required in body' });

    const arxivPapers = await fetchArxivPapers(topic, maxResults);

    const savedPapers = [];
    for (const p of arxivPapers) {
      const filter = p.arxivId ? { arxivId: p.arxivId } : { title: p.title };
      const update = {
        $set: {
          topic,
          title: p.title,
          summary: p.summary,
          rawSummary: p.rawSummary,
          authors: p.authors,
          pdfUrl: p.pdfUrl,
          published: p.published,
          sourceUrl: p.sourceUrl
        }
      };
      let doc = await Paper.findOne(filter).lean();
      if (!doc) {
        const created = new Paper(Object.assign({ topic }, p));
        await created.save();
        doc = created.toObject();
      } else {
        await Paper.updateOne(filter, update);
        doc = await Paper.findOne(filter).lean();
      }
      savedPapers.push(doc);
    }

    let finalPapers = savedPapers;
    if (summarize && savedPapers.length > 0) {
      const ids = savedPapers.map(s => s._id);
      const docs = await Paper.find({ _id: { $in: ids } }).lean();
      const summarized = await summarizePapersSequential(docs);
      for (const sp of summarized) {
        await Paper.updateOne({ _id: sp._id }, { $set: { aiSummary: sp.aiSummary, aiSummaryAt: sp.aiSummaryAt } }).catch(() => {});
      }
      finalPapers = await Paper.find({ _id: { $in: ids } }).lean();
    }

    // Prepare a concise AI response for chat history
    const aiResponse = summarize
      ? `I found ${finalPapers.length} research papers on "${topic}". Here are the key findings:\n\n${finalPapers.map(p => `**${p.title}**\n${p.aiSummary || p.summary}`).join('\n\n')}`
      : `Found ${finalPapers.length} papers on "${topic}".`;

    // Save user question and AI response to chat history
    await saveChatMessages(req.user.userId, `Find papers on ${topic}`, aiResponse);

    return res.json({ topic, count: finalPapers.length, papers: finalPapers, aiResponse });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/papers/:id  -> fetch the paper doc (includes aiSummary if present)
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await Paper.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Paper not found' });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

router.post('/:id/ask', auth, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id).lean();
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const question = req.body.question;
    if (!question) return res.status(400).json({ error: 'Question is required in body' });

    // Compose context for Cohere
    const context = paper.aiSummary || paper.rawSummary || paper.summary || '';
    const prompt = `You are an expert research assistant. Based on the following research paper content, answer the user's question concisely and clearly.\nPaper:\n"""${context}"""\nQuestion: ${question}\nAnswer:`;

    // Call Cohere for answer
    const axios = require('axios');
    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    const response = await axios.post(
      'https://api.cohere.ai/v1/generate',
      {
        model: 'command',
        prompt,
        max_tokens: 200,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer = response.data.generations[0].text.trim();

    // Optionally, save Q&A to chat history
    const ChatSession = require('../models/History.js');
    let session = await ChatSession.findOne({ userId: req.user.userId })
      .sort({ updatedAt: -1 });
    
    if (!session) {
      session = new ChatSession({ 
        userId: req.user.userId, 
        title: 'New Chat',
        messages: [] 
      });
    }
    
    session.messages.push({ role: 'user', text: question });
    session.messages.push({ role: 'bot', text: answer });
    await session.save();

    res.json({ answer });
  } catch (err) {
    console.error('Q&A error:', err);
    res.status(500).json({ error: 'Q&A failed' });
  }
});


/**
 * POST /api/papers/compare
 * body: { ids: [paperId1, paperId2, ...] }
 * -> Runs Gemini compare and returns AI comparison
 */
router.post('/compare', async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!ids || !Array.isArray(ids) || ids.length < 2) return res.status(400).json({ error: 'Provide array of at least 2 paper ids' });

    const docs = await Paper.find({ _id: { $in: ids } }).lean();
    if (!docs || docs.length < 2) return res.status(400).json({ error: 'Not enough papers found' });

    const items = docs.map(d => ({ title: d.title, aiSummary: d.aiSummary || d.rawSummary || d.summary }));

    const comparison = await compareSummaries(items);
    return res.json({ comparison, docs });
  } catch (err) {
    console.error('Compare error:', err);
    return res.status(500).json({ error: 'Comparison failed' });
  }
});

module.exports = router;
