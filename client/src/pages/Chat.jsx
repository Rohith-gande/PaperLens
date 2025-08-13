import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Header from '../components/Header';

export default function Chat() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]); // {role:'user'|'bot', text:string}
  const [input, setInput] = useState('');
  const [papers, setPapers] = useState([]); // last search papers
  const [selected, setSelected] = useState(new Set()); // paper ids to compare
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]); // chat sessions
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { 
    endRef.current?.scrollIntoView({ behavior:'smooth' }); 
  }, [messages]);

  // Load chat sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Load messages for current session
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
      setPapers([]);
    }
  }, [currentSessionId]);

  const loadSessions = async () => {
    try {
      const { data } = await api.get('/chat/sessions');
      setSessions(data.sessions || []);
      
      // Don't automatically load the most recent session
      // Let the user choose which session to load
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    try {
      const { data } = await api.get(`/chat/session/${sessionId}`);
      setMessages(data.messages || []);
      
      // Don't clear papers when switching sessions - they should persist
      // Only clear papers if this is a completely new session with no messages
      if (!data.messages || data.messages.length === 0) {
        setPapers([]);
        setSelected(new Set());
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
      setMessages([]);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMessage = async (role, text) => {
    // Only create new session if we're in a "new chat" state and this is a user message
    if (!currentSessionId && role === 'user') {
      // Create new session
      try {
        const { data } = await api.post('/chat/session', {
          title: text.length > 50 ? text.substring(0, 50) + '...' : text,
          messages: [{ role, text }]
        });
        setCurrentSessionId(data.sessionId);
        await loadSessions(); // Refresh sessions list
        return data.sessionId;
      } catch (err) {
        console.error('Failed to create session:', err);
        return null;
      }
    } else if (currentSessionId) {
      // Add message to existing session
      try {
        await api.post(`/chat/session/${currentSessionId}/message`, { role, text });
        return currentSessionId;
      } catch (err) {
        console.error('Failed to save message:', err);
        return null;
      }
    }
    
    // If no session and not a user message, don't create one
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMsg = { role: 'user', text: input.trim() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setIsTyping(true);
    
    // Save user message
    const sessionId = await saveMessage('user', userMsg.text);
    
    // Check if user wants to compare papers
    const isCompareRequest = userMsg.text.toLowerCase().includes('compare') && papers.length > 0;
    
    // Also check for other comparison-related keywords
    const comparisonKeywords = ['compare', 'comparison', 'compare these', 'compare papers'];
    const isComparisonRequest = comparisonKeywords.some(keyword => 
      userMsg.text.toLowerCase().includes(keyword)
    ) && papers.length > 0;
    
    if (isCompareRequest || isComparisonRequest) {
      // Handle comparison request
      if (selected.size < 2) {
        const errorText = 'Please select at least 2 papers to compare. You can select papers using the checkboxes above.';
        setMessages(m => [...m, { role:'bot', text: errorText }]);
        if (sessionId) {
          await saveMessage('bot', errorText);
        }
      } else {
        // Use the existing compare function
        await compare();
      }
    } else {
      // Handle regular search request
      try {
        const { data } = await api.post('/papers/search', { 
          topic: userMsg.text, 
          summarize: true, 
          maxResults: 5 
        });
        setPapers(data.papers || []);
        
        // The backend now provides a complete response with summaries
        const botText = data.aiResponse || `I found ${data.count} research papers on "${data.topic}". Here are the results:`;
        setMessages(m => [...m, { role:'bot', text: botText }]);
        
        // Save bot message
        if (sessionId) {
          await saveMessage('bot', botText);
        }
      } catch (err) {
        const errorText = err.response?.data?.error || 'Sorry, I encountered an error while searching for papers. Please try again.';
        setMessages(m => [...m, { role:'bot', text: errorText }]);
        
        // Save error message
        if (sessionId) {
          await saveMessage('bot', errorText);
        }
      }
    }
    
    setLoading(false);
    setIsTyping(false);
    inputRef.current?.focus();
  };

  const compare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setIsTyping(true);
    
    try {
      const ids = Array.from(selected);
      const { data } = await api.post('/papers/compare', { ids });
      
      // The comparison now returns natural text directly
      const comparisonText = data.comparison || 'No comparison available.';
      
      setMessages(m => [...m, { role:'bot', text: comparisonText }]);
      
      // Save comparison message
      if (currentSessionId) {
        await saveMessage('bot', comparisonText);
      }
    } catch (err) {
      const errorText = err.response?.data?.error || 'Sorry, I encountered an error while comparing the papers. Please try again.';
      setMessages(m => [...m, { role:'bot', text: errorText }]);
      
      // Save error message
      if (currentSessionId) {
        await saveMessage('bot', errorText);
      }
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const askOnPaper = async (paperId, question) => {
    if (!question.trim()) return;
    const userMsg = { role: 'user', text: `Q about paper: ${question}` };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    setIsTyping(true);
    
    // Save user question
    const sessionId = await saveMessage('user', userMsg.text);
    
    try {
      const { data } = await api.post(`/papers/${paperId}/ask`, { question });
      setMessages(m => [...m, { role:'bot', text: data.answer }]);
      
      // Save bot answer
      if (sessionId) {
        await saveMessage('bot', data.answer);
      }
    } catch (err) {
      const errorText = err.response?.data?.error || 'Sorry, I encountered an error while answering your question. Please try again.';
      setMessages(m => [...m, { role:'bot', text: errorText }]);
      
      // Save error message
      if (sessionId) {
        await saveMessage('bot', errorText);
      }
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setPapers([]);
    setSelected(new Set());
    setSidebarOpen(false);
  };

  const selectSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
    // Don't clear papers when selecting a session - they should persist
    // Papers will only be cleared when starting a new chat or when the session has no messages
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/session/${sessionId}`);
      await loadSessions();
      
      // If we deleted the current session, start a new chat
      if (sessionId === currentSessionId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="h-screen bg-gray-50 text-gray-900 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-80 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <button 
              onClick={startNewChat}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              + New chat
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Chat History
              </h3>
              <div className="space-y-2">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div 
                      key={session._id} 
                      className={`text-sm text-gray-300 hover:text-white cursor-pointer p-2 rounded hover:bg-gray-800 transition-colors group ${
                        currentSessionId === session._id ? 'bg-gray-800 text-white' : ''
                      }`}
                      onClick={() => selectSession(session._id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="truncate flex-1">{session.title}</div>
                        <button
                          onClick={(e) => deleteSession(session._id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity ml-2"
                        >
                          ×
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm">No chats yet.</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-gray-700">
            <button 
              onClick={handleLogout}
              className="w-full text-gray-400 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex-1 flex flex-col bg-white">
        <Header 
          onNewChat={startNewChat}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔬</div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Research Assistant</h2>
                <p className="text-gray-600 mb-6">I can help you find and analyze research papers on any topic.</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>Try asking: "Find papers about machine learning"</p>
                  <p>Or: "Research on climate change"</p>
                  <p>Or: "Papers about quantum computing"</p>
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}

            {/* Paper results */}
            {papers.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700">📄 Research Papers Found</div>
                {papers.map(p => (
                  <PaperCard 
                    key={p._id} 
                    paper={p} 
                    selected={selected.has(p._id)}
                    onToggle={() => toggleSelect(p._id)}
                    onAsk={(q) => askOnPaper(p._id, q)}
                  />
                ))}
                <div className="flex flex-col items-center space-y-3">
                  <button
                    onClick={compare}
                    disabled={selected.size < 2 || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {loading ? 'Comparing...' : `Compare Selected Papers (${selected.size})`}
                  </button>
                  {papers.length >= 2 && (
                    <div className="text-xs text-gray-500 text-center">
                      💡 Tip: You can also type "compare these papers" or "compare" in the chat to compare selected papers
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={endRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={submit} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me to find research papers on any topic..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button 
                type="submit"
                disabled={loading || !input.trim()} 
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              I'll search arXiv and provide AI-powered summaries of the research papers.
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  // Simple markdown-like formatting for bot messages
  const formatText = (text) => {
    if (isUser) return text; // Don't format user messages
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
      .replace(/\n\n/g, '<br><br>') // Double line breaks
      .replace(/\n/g, '<br>'); // Single line breaks
  };
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} message-bubble`}>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
        isUser 
          ? 'message-bubble-user text-white' 
          : 'message-bubble-bot text-gray-900'
      }`}>
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: formatText(message.text) 
          }}
        />
      </div>
    </div>
  );
}

function PaperCard({ paper, selected, onToggle, onAsk }) {
  const [expand, setExpand] = useState(false);
  const [question, setQuestion] = useState('');
  const summary = paper.aiSummary || paper.summary || '';

  return (
    <div className={`border rounded-lg p-4 transition-all paper-card paper-card-hover ${
      selected 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-start gap-3">
        <input 
          type="checkbox" 
          checked={selected} 
          onChange={onToggle} 
          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{paper.title}</h3>
          <p className="text-sm text-gray-600 mb-2">
            {paper.authors?.join(', ')}
          </p>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            {summary.length > 400 ? `${summary.substring(0, 400)}...` : summary}
          </p>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {paper.pdfUrl && (
              <a 
                target="_blank" 
                href={paper.pdfUrl} 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
              >
                📄 PDF
              </a>
            )}
            {paper.sourceUrl && (
              <a 
                target="_blank" 
                href={paper.sourceUrl} 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
              >
                🔗 arXiv
              </a>
            )}
            <button 
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
              onClick={() => setExpand(e => !e)}
            >
              {expand ? '❌ Hide Q&A' : '❓ Ask about this paper'}
            </button>
          </div>
          
          {expand && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask a question about this paper..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      onAsk(question);
                      setQuestion('');
                    }
                  }}
                />
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  onClick={() => {
                    onAsk(question);
                    setQuestion('');
                  }}
                >
                  Ask
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}