import React from 'react';

function ResultsPanel({ analysis, error }) {
  if (error) {
    return (
      <div className="results-card">
        <h3 className="accent-text">Analysis Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="results-card">
        <h3 className="accent-text">Current Object Analysis</h3>
        <p>Upload an image to begin object detection and recall.</p>
      </div>
    );
  }

  return (
    <div className="results-card">
      <h3 className="accent-text">Current Object Analysis</h3>

      <div className="result-row">
        <span>Status</span>
        <strong>{analysis.match_status}</strong>
      </div>

      <div className="result-row">
        <span>Label</span>
        <strong>{analysis.matched_label}</strong>
      </div>

      <div className="result-row">
        <span>Similarity</span>
        <strong>{analysis.similarity_score}%</strong>
      </div>

      {analysis.closest_match && (
        <div className="result-row">
          <span>Closest Match</span>
          <strong>{analysis.closest_match}</strong>
        </div>
      )}

      <div className="result-block">
        <h4>Description</h4>
        <p>{analysis.ui_description}</p>
      </div>
    </div>
  );
}

export default ResultsPanel;