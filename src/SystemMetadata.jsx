// visionvault-ui/src/SystemMetadata.jsx
import React, { useState, useEffect } from 'react';

function SystemMetadata({ scanResult, handleUpdateHistoryTitle }) {
  const [customName, setCustomName] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (scanResult) {
      setCustomName(scanResult.hardware_identity);
    } else {
      setCustomName('');
    }
  }, [scanResult]);
  if (!scanResult) {
    return (
      <div className="glass-card placeholder-box" style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
        <p style={{ margin: 0, color: '#d1d5db' }}>
          Awaiting scan data...
        </p>
      </div>
    );
  }

  const {
    certainty_score,
    unique_identifiers = [],
    spatial_context,
    view_invariance,
  } = scanResult;

  const score = scanResult.certainty_score;
  const badgeColor = score >= 80 ? '#4caf50' : score >= 50 ? '#ffeb3b' : '#f44336';

  return (
    <div className="glass-card placeholder-box" style={{ padding: '15px', minHeight: '160px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isEditingTitle ? (
            <>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>{customName || 'Unknown Hardware'}</h2>
              <button onClick={() => setIsEditingTitle(true)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✏️</button>
            </>
          ) : (
            <>
              <textarea
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  width: '100%',
                  outline: 'none',
                  resize: 'none',
                  minHeight: '2rem',
                  boxSizing: 'border-box',
                  flex: 1,
                }}
              />
              <button onClick={() => { setIsEditingTitle(false); if (handleUpdateHistoryTitle && scanResult.id) handleUpdateHistoryTitle(scanResult.id, customName); }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✅</button>
            </>
          )}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.5rem 0.85rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: badgeColor, display: 'inline-block' }} />
          <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600' }}>
            {scanResult?.status === 'update' 
              ? 'Similarity: ' + (scanResult?.similarity_score ?? 0) 
              : 'Confidence: ' + (certainty_score ?? 0)}%
          </span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#d1d5db' }}>Marks & Dents</h4>
          {unique_identifiers.length ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {unique_identifiers.map((id, index) => (
                <div key={index} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '0.75rem', color: '#e2e8f0', fontSize: '0.9rem' }}>
                  {id}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem' }}>No unique anomalies detected.</p>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#d1d5db' }}>View Invariance</h4>
          <p style={{ margin: 0, color: '#f8fafc', lineHeight: '1.6', fontSize: '0.9rem' }}>{view_invariance || 'No invariance data available.'}</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#d1d5db' }}>Spatial Context</h4>
          <p style={{ margin: 0, color: '#f8fafc', lineHeight: '1.6', fontSize: '0.9rem' }}>{spatial_context || 'No spatial context available.'}</p>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#d1d5db' }}>Suggested Labels</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {scanResult.suggested_labels && scanResult.suggested_labels.length ? (
            scanResult.suggested_labels.map((label, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '999px',
                  background: 'rgba(59, 130, 246, 0.18)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  minWidth: '80px',
                }}
              >
                {label}
              </span>
            ))
          ) : (
            <span style={{ color: '#cbd5e1' }}>No labels available.</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SystemMetadata;