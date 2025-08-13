const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema({
  topic: { type: String, index: true },
  arxivId: { type: String, unique: true, sparse: true },
  title: String,
  summary: String,
  authors: [String],
  pdfUrl: String,
  published: Date,
  sourceUrl: String,
  // AI fields
  aiSummary: String,
  aiSummaryAt: Date,
  // raw arXiv summary stored for reference
  rawSummary: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Paper', PaperSchema);
