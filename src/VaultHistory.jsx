import React, { useState } from 'react';

function VaultHistory({ scanHistory, setScanHistory, setViewMode, setRecallItem }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAISearching, setIsAISearching] = useState(false);
  
  // NEW STATE: Holds the IDs found by the AI. If null, we use local search.
  const [aiMatchedIds, setAiMatchedIds] = useState(null);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setScanHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleRecall = (item) => {
    setRecallItem(item);
    setViewMode('recall');
  };

  // --- THE FUZZY LOCAL SEARCH ---
  const displayedHistory = aiMatchedIds !== null 
    // If AI searched, ONLY show what the AI found
    ? scanHistory.filter(item => aiMatchedIds.includes(item.id))
    // Otherwise, use the upgraded Fuzzy Local Search
    : scanHistory.filter(item => {
        if (!searchTerm) return true;
        const lowerQuery = searchTerm.toLowerCase();
        const lowerTitle = item.title.toLowerCase();
        
        // 1. Exact phrase match
        if (lowerTitle.includes(lowerQuery)) return true;
        
        // 2. Word-by-word overlap (fixes the "my gaming mouse" bug)
        const searchWords = lowerQuery.split(' ').filter(word => word.length > 2);
        return searchWords.some(word => lowerTitle.includes(word));
      });

  const handleDeepSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsAISearching(true);
    try {
      // Strip images so we don't overload the network
      const safeHistory = scanHistory.map(({ frontImage, backImage, frontCrop, backCrop, ...rest }) => rest);
      
      const response = await fetch('http://localhost:5000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchTerm, history: safeHistory }),
      });
      
      const data = await response.json();
      
      // Update the sidebar with the array of matches! No forced recall mode.
      if (data.matched_ids) {
        setAiMatchedIds(data.matched_ids);
        if (data.matched_ids.length === 0) {
            alert("Deep Search couldn't find anything matching that description.");
        }
      }
    } catch (error) {
      console.error('Deep search error:', error);
    } finally {
      setIsAISearching(false);
    }
  };

  // When the user types, clear the AI search results so local search takes over again
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (aiMatchedIds !== null) {
      setAiMatchedIds(null);
    }
  };

  return (
    <div>
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Search vault..." 
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={e => { if (e.key === 'Enter') handleDeepSearch(); }}
        />
      </div>
  
      {isAISearching && <div style={{ padding: '0.5rem', color: '#a1aeba', fontSize: '0.8rem', textAlign: 'center' }}>Deep Scanning AI...</div>}
      
      <div className="vault-content">
        {displayedHistory.length === 0 && !isAISearching ? (
          <p>No scans in history yet.</p>
        ) : (
          displayedHistory.map(item => (
            <div key={item.id} onClick={() => handleRecall(item)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 
            'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', 
                  backgroundColor: '#3b82f6', color: 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 'bold', flexShrink: 0, fontSize: '1.2rem'
                  }}>
                      {item.title ? item.title.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>{item.title}</div>
                <div style={{ color: '#d1d5db', fontSize: '0.75rem' }}>{item.date}</div>
              </div>
      
              <button onClick={(e) => handleDelete(item.id, e)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default VaultHistory;