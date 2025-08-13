const axios = require('axios');
const COHERE_API_KEY = process.env.COHERE_API_KEY;

/**
 * summarizeText: returns natural language summary
 */
async function summarizeText(text) {
  try {
    const response = await axios.post(
      'https://api.cohere.ai/v1/generate',
      {
        model: 'command',
        prompt: `You are an expert research analyst. Summarize the following research paper in a clear, natural language format. Focus on the key points and make it easy to understand.

Write a concise summary that includes:
- What the research is about
- The main problem or question being addressed
- The approach or methodology used
- Key findings or results
- Any important limitations or future work

Keep it conversational and easy to read, like you're explaining it to someone who wants to understand the research quickly.

Research paper text:
"""${text}"""

Summary:`,
        max_tokens: 400,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.generations[0].text.trim();
  } catch (err) {
    console.error('Cohere call error:', err.response?.data || err.message || err);
    throw new Error('Cohere API call failed');
  }
}

/**
 * compareSummaries: takes array of {title, aiSummary} and returns natural text comparison
 */
async function compareSummaries(items) {
  const textParts = items.map((it, i) => `${i+1}. Title: ${it.title}\nSummary: ${it.aiSummary || it.summary || ''}`).join('\n\n');

  try {
    const response = await axios.post(
      'https://api.cohere.ai/v1/generate',
      {
        model: 'command',
        prompt: `You are an expert research analyst. Compare these research papers and provide a comprehensive analysis in a natural, conversational tone like ChatGPT would. 

Structure your response as follows:

**Overview:**
Provide a 2-3 sentence overview of how these papers relate to each other and their collective contribution to the field.

**Key Differences:**

For each paper, discuss:
- **Research Focus:** What specific aspect or problem does this paper address?
- **Methodology:** How did the researchers approach their study?
- **Key Findings:** What were the main results or insights?
- **Contributions:** What does this work add to the field?

**Synthesis:**
End with 2-3 sentences that synthesize the papers and highlight their complementary or contrasting perspectives.

Write in a clear, engaging style that would be helpful for someone trying to understand these papers. Avoid technical jargon when possible, and make the comparison accessible.

Papers to compare:
${textParts}`,
        max_tokens: 1000,
        temperature: 0.4,
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.generations[0].text.trim();
  } catch (err) {
    console.error('Cohere call error:', err.response?.data || err.message || err);
    throw new Error('Cohere API call failed');
  }
}

module.exports = {
  summarizeText,
  compareSummaries
};