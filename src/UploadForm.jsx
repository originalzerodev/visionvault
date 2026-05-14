import React, { useState } from 'react';

function UploadForm({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleBrowse = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  };

  return (
    <div className="upload-card">
      <div
        className={`upload-dropzone ${dragging ? 'upload-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="accent-text">Drag & drop an image here</p>
        <p>or</p>
        <label className="button">
          Select image
          <input
            type="file"
            accept="image/*"
            onChange={handleBrowse}
            style={{ display: 'none' }}
            disabled={loading}
          />
        </label>
      </div>

      {loading && <p style={{ marginTop: '1rem' }}>Analyzing image...</p>}
    </div>
  );
}

export default UploadForm;