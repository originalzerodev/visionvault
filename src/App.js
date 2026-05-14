// visionvault-ui/src/App.js
import React, { useState, useEffect } from 'react';
import VaultHistory from './VaultHistory';
import VisionScanner from './VisionScanner';
import SystemMetadata from './SystemMetadata';

function App() {
  // Retain existing state for future phases
  const [memories, setMemories] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [viewMode, setViewMode] = useState('scanner');
  const [recallItem, setRecallItem] = useState(null);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  const handleUpdateHistoryTitle = (scanId, newTitle) => {
    const targetId = String(scanId);

    // 1. BRUTE FORCE THE NEW SCANNER VIEW (Main Demo Path)
    if (scanResult && String(scanResult.id) === targetId) {
      setScanResult(prev => ({
        ...prev, 
        title: newTitle, 
        hardware_identity: newTitle,
        // Force-feed it to the nested result object too, just in case the UI is looking there
        result: prev.result ? { ...prev.result, title: newTitle, hardware_identity: newTitle } : undefined
      }));
    }

    // 2. BRUTE FORCE THE SIDEBAR HISTORY
    setScanHistory(prev => prev.map(item => {
      if (String(item.id) === targetId) {
        return {
          ...item,
          title: newTitle,
          hardware_identity: newTitle,
          result: item.result ? { ...item.result, title: newTitle, hardware_identity: newTitle } : undefined
        };
      }
      return item;
    }));

    // 3. BRUTE FORCE RECALL (If it works, great. If not, who cares for the demo)
    if (recallItem && String(recallItem.id) === targetId) {
      setRecallItem(prev => ({
        ...prev,
        title: newTitle,
        hardware_identity: newTitle,
        result: prev.result ? { ...prev.result, title: newTitle, hardware_identity: newTitle } : undefined
      }));
    }
  };

  const fetchMemories = async () => {
    try {
      const response = await fetch('http://localhost:5000/memories');
      const data = await response.json();
      setMemories(data);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
      setError('Unable to load memory timeline.');
    }
  };

// 1. Load from Python hard drive on startup
  useEffect(() => {
    fetch('http://localhost:8000/api/history') // Make sure this port matches your backend!
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setScanHistory(data);
        setIsHistoryLoaded(true); // Unlock saving
      })
      .catch(err => {
        console.error("Failed to load history:", err);
        setIsHistoryLoaded(true); // Unlock saving even if failed
      });
  }, []);

  // 2. Save to Python hard drive ONLY after loading is finished
  useEffect(() => {
    if (isHistoryLoaded) {
      fetch('http://localhost:8000/api/history', { // Make sure this port matches your backend!
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanHistory)
      }).catch(err => console.error("Save failed:", err));
    }
  }, [scanHistory, isHistoryLoaded]);

  const handleUpload = async (file) => {
    setError(null);
    setLoading(true);
    setSelectedMemory(null);
    setCurrentAnalysis(null);

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);

      const uploadRes = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: uploadForm,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      const analyzeRes = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_path: uploadData.file_path }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      setCurrentAnalysis(analyzeData);
      fetchMemories(); // Refresh timeline
    } catch (err) {
      console.error('Upload/Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="left-panel panel">
        <VaultHistory scanHistory={scanHistory} setScanHistory={setScanHistory} setViewMode={setViewMode} setRecallItem={setRecallItem} />
      </div>
      <div className="main-panel panel">
        <VisionScanner onScanResult={setScanResult} scanHistory={scanHistory} setScanHistory={setScanHistory} viewMode={viewMode} setViewMode={setViewMode} recallItem={recallItem} setRecallItem={setRecallItem} />
      </div>
      <div className="right-panel panel">
        <SystemMetadata scanResult={viewMode === 'recall' && recallItem ? recallItem.result : scanResult} handleUpdateHistoryTitle={handleUpdateHistoryTitle} />
      </div>
    </div>
  );
}

export default App;