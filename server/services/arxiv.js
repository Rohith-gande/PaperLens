const axios = require('axios');
const xml2js = require('xml2js');

// Original "Attention Is All You Need" paper details
const ORIGINAL_TRANSFORMER_PAPER = {
  title: "Attention Is All You Need",
  authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"],
  summary: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks in an encoder-decoder configuration. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show that these models are superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing with large amounts of training data.",
  arxivId: "1706.03762",
  sourceUrl: "https://arxiv.org/abs/1706.03762",
  pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
  published: new Date("2017-06-12")
};

/**
 * Fetches papers from arXiv for the given topic.
 * Returns array of { title, summary, authors, pdfUrl, published, sourceUrl, arxivId }
 */
async function fetchArxivPapers(topic, maxResults = 3) {
  // Improve search query construction for better relevance
  let searchQuery;
  let shouldIncludeOriginal = false;
  
  // Handle specific cases for better results
  if (topic.toLowerCase().includes('attention is all you need') || 
      topic.toLowerCase().includes('transformer') ||
      topic.toLowerCase().includes('vaswani') ||
      topic.toLowerCase().includes('attention mechanism')) {
    // For transformer-related searches, be more specific
    searchQuery = `ti:"attention is all you need" OR ti:transformer OR au:vaswani OR all:"attention mechanism" OR all:"self attention"`;
    shouldIncludeOriginal = true;
  } else if (topic.toLowerCase().includes('bert') || topic.toLowerCase().includes('gpt')) {
    // For specific model searches
    searchQuery = `ti:${topic} OR all:${topic}`;
  } else {
    // For general searches, use title and abstract for better relevance
    searchQuery = `ti:${topic} OR abs:${topic}`;
  }
  
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults * 3}&sortBy=relevance&sortOrder=descending`;
  
  try {
    const res = await axios.get(url, { timeout: 15000 });
    const xml = res.data;
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

    const entries = parsed.feed && parsed.feed.entry ? parsed.feed.entry : [];
    const arr = Array.isArray(entries) ? entries : [entries];

    const papers = arr.map(entry => {
      // links may be array or object
      let pdfUrl = '';
      if (Array.isArray(entry.link)) {
        const pdfLink = entry.link.find(l => l.type === 'application/pdf' || l.title === 'pdf' || l['$']?.type === 'application/pdf');
        if (pdfLink) pdfUrl = pdfLink.href || pdfLink._ || (pdfLink['$'] && pdfLink['$'].href);
      } else if (entry.link && (entry.link.type === 'application/pdf' || entry.link.title === 'pdf')) {
        pdfUrl = entry.link.href || entry.link._ || (entry.link['$'] && entry.link['$'].href);
      }

      const authors = [];
      if (Array.isArray(entry.author)) {
        entry.author.forEach(a => { if (a && a.name) authors.push(a.name); });
      } else if (entry.author && entry.author.name) {
        authors.push(entry.author.name);
      }

      const arxivId = entry.id ? String(entry.id).split('/').pop() : undefined;

      return {
        arxivId,
        title: entry.title ? String(entry.title).trim() : '',
        summary: entry.summary ? String(entry.summary).trim() : '',
        rawSummary: entry.summary ? String(entry.summary).trim() : '',
        authors,
        pdfUrl,
        published: entry.published ? new Date(entry.published) : null,
        sourceUrl: entry.id || ''
      };
    });

    // Enhanced filtering and scoring for better relevance
    const scoredPapers = papers.map(paper => {
      const title = paper.title.toLowerCase();
      const summary = paper.summary.toLowerCase();
      const searchTerms = topic.toLowerCase().split(' ');
      
      let score = 0;
      
      // Higher score for exact matches in title
      if (title.includes(topic.toLowerCase())) {
        score += 10;
      }
      
      // Score for individual terms in title
      searchTerms.forEach(term => {
        if (title.includes(term)) score += 3;
        if (summary.includes(term)) score += 1;
      });
      
      // Bonus for transformer-related papers when searching for attention
      if (topic.toLowerCase().includes('attention') && 
          (title.includes('transformer') || title.includes('attention') || summary.includes('transformer'))) {
        score += 5;
      }
      
      // Bonus for Vaswani et al. paper specifically
      if (title.includes('attention is all you need') || 
          paper.authors.some(author => author.toLowerCase().includes('vaswani'))) {
        score += 15;
      }
      
      return { ...paper, relevanceScore: score };
    });

    // Filter out irrelevant papers and sort by relevance
    let filteredPapers = scoredPapers
      .filter(paper => paper.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults)
      .map(paper => {
        // Remove the score from the final result
        const { relevanceScore, ...paperWithoutScore } = paper;
        return paperWithoutScore;
      });

    // If searching for attention/transformer and original paper not found, add it
    if (shouldIncludeOriginal && filteredPapers.length > 0) {
      const hasOriginal = filteredPapers.some(paper => 
        paper.title.toLowerCase().includes('attention is all you need') ||
        paper.authors.some(author => author.toLowerCase().includes('vaswani'))
      );
      
      if (!hasOriginal) {
        filteredPapers.unshift(ORIGINAL_TRANSFORMER_PAPER);
        filteredPapers = filteredPapers.slice(0, maxResults);
      }
    }

    return filteredPapers;
  } catch (err) {
    console.error('arXiv fetch error:', err.message || err);
    throw new Error('Failed to fetch from arXiv');
  }
}

module.exports = {
  fetchArxivPapers
};
