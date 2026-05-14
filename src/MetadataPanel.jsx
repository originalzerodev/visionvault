import React from 'react';

function MetadataPanel({ memory }) {
  if (!memory) {
    return (
      <div className="metadata-card">
        <h3 className="accent-text">Metadata</h3>
        <p>Select a memory or analyze an object to see forensics, context, and history.</p>
      </div>
    );
  }

  return (
    <div className="metadata-card">
      <h3 className="accent-text">Metadata</h3>

      <div className="metadata-block">
        <h4>Unique Marks</h4>
        <p>{memory.secret_forensics || 'No forensic details available.'}</p>
      </div>

      <div className="metadata-block">
        <h4>Contextual Notes</h4>
        <p>{memory.secret_location || 'No location context available.'}</p>
      </div>

      <div className="metadata-block">
        <h4>Update History</h4>
        <p>{memory.timestamp || 'Unknown'}</p>
      </div>
    </div>
  );
}

export default MetadataPanel;