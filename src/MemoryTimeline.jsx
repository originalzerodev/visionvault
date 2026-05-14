import React from 'react';

function MemoryTimeline({ memories, onSelect }) {
  return (
    <div className="timeline-card">
      <h3 className="accent-text">Memory Timeline</h3>
      <div className="timeline-list">
        {memories.length === 0 ? (
          <p>No memories yet. Run a scan to build the timeline.</p>
        ) : (
          memories.map((memory, index) => (
            <button
              key={`${memory.timestamp}-${index}`}
              className="timeline-item"
              onClick={() => onSelect(memory)}
            >
              <div className="timeline-label">{memory.label}</div>
              <div className="timeline-time">{memory.timestamp}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default MemoryTimeline;