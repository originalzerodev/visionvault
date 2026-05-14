// visionvault-ui/src/VisionScanner.jsx
import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function VisionScanner({ onScanResult, scanHistory, setScanHistory, viewMode, setViewMode, recallItem, setRecallItem }) {
  const [workspaceTab, setWorkspaceTab] = useState('scanner');
  const [images, setImages] = useState({ front: null, back: null });
  const [crops, setCrops] = useState({ 
    front: { unit: '%', x: 0, y: 0, width: 30, height: 30, aspect: undefined }, 
    back: { unit: '%', x: 0, y: 0, width: 30, height: 30, aspect: undefined } 
  });
  const [completedCrops, setCompletedCrops] = useState({ front: null, back: null });
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRefFront = useRef(null);
  const fileInputRefBack = useRef(null);
  const imgRefFront = useRef(null);
  const imgRefBack = useRef(null);

  const handleFileSelect = (side) => (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setImages(prev => ({ ...prev, [side]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (side) => (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setImages(prev => ({ ...prev, [side]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleClear = (side) => {
    setImages(prev => ({ ...prev, [side]: null }));
    setCrops(prev => ({ ...prev, [side]: { unit: '%', x: 0, y: 0, width: 30, height: 30, aspect: undefined } }));
    setCompletedCrops(prev => ({ ...prev, [side]: null }));

    const fileInput = side === 'front' ? fileInputRefFront.current : fileInputRefBack.current;
    if (fileInput) {
      fileInput.value = '';
    }
  };

const getCroppedImg = (image, crop) => {
    // Safety check: if no crop was drawn, abort the crop
    if (!image || !crop || !crop.width || !crop.height) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0, 0, 
      crop.width, 
      crop.height
    );

    return canvas.toDataURL('image/webp', 0.5);
  };

const compressFullImage = (image, quality = 0.8) => {
    if (!image) return null;
    const canvas = document.createElement('canvas');

    // Cap the size at 1280px. Big enough for AI eyesight, small enough for speed.
    const MAX_WIDTH = 1280;
    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/webp', quality);
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      // PASS 1: Compress the full backgrounds (80% Quality)
      let frontOriginalBase64 = images.front ? compressFullImage(imgRefFront.current, 0.8) : null;
      let backOriginalBase64 = images.back ? compressFullImage(imgRefBack.current, 0.8) : null;

      // PASS 2: Compress the tiny crops (50% Quality)
      let frontCropBase64 = null;
      let backCropBase64 = null;

      if (images.front && completedCrops.front && completedCrops.front.width > 0) {
        frontCropBase64 = getCroppedImg(imgRefFront.current, completedCrops.front);
      }
      if (images.back && completedCrops.back && completedCrops.back.width > 0) {
        backCropBase64 = getCroppedImg(imgRefBack.current, completedCrops.back);
      }

      const safeHistory = scanHistory.map(({ frontImage, backImage, frontCrop, backCrop, ...rest }) => rest);
      setScanHistory(prev => [
        { id: 'temp-loader', title: 'Scanning Object...', frontCrop: frontCropBase64 || images.front },
        ...prev,
      ]);

      const payload = {
        front: {
          original: frontOriginalBase64, // Using the new 80% compressed version
          crop: frontCropBase64
        },
        back: {
          original: backOriginalBase64, // Using the new 80% compressed version
          crop: backCropBase64
        },
        history: safeHistory,
      };
      
      // Verification of the "Hustle"
      const originalSize = images.front ? Math.round(images.front.length / 1024) : 0;
      const compressedSize = frontCropBase64 ? Math.round(frontCropBase64.length / 1024) : 0;

      console.log(`--- Memory Audit ---`);
      console.log(`Original Upload: ${originalSize} KB`);
      console.log(`WebP Compressed: ${compressedSize} KB`);
      console.log(`Space Saved: ${originalSize > 0 ? Math.round((1 - compressedSize/originalSize) * 100) : 0}%`);
      console.log(`History Metadata: ${Math.round(JSON.stringify(safeHistory).length / 1024)} KB`);
      const response = await fetch('http://localhost:8000/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Backend Response:', data);

      if (onScanResult) {
        onScanResult({ ...data, id: Date.now() });
      }

      setScanHistory(prev => prev.filter(item => item.id !== 'temp-loader'));

      if (data.status === 'update' && data.matched_id !== null && data.matched_id !== undefined) {
        setScanHistory(prev => {
          const cleaned = prev.filter(item => item.id !== 'temp-loader');
          const match = cleaned.find(item => item.id === data.matched_id);
          if (!match) {
            return cleaned;
          }
          const updatedItem = {
            ...match,
            result: data,
            frontImage: images.front,
            backImage: images.back,
            frontCrop: frontCropBase64,
            backCrop: backCropBase64,
            date: new Date().toISOString().replace('T', ' ').split('.')[0],
          };
          return [updatedItem, ...cleaned.filter(item => item.id !== data.matched_id)];
        });
      } else if (data.status === 'new_object') {
        const id = Date.now();
        const defaultTitle = data.hardware_identity || (data.suggested_labels && data.suggested_labels.length > 0 ? data.suggested_labels[0].charAt(0).toUpperCase() + data.suggested_labels[0].slice(1) : 'Scanned Object');
        const newHistoryItem = {
          id,
          title: defaultTitle,
          date: new Date().toISOString().replace('T', ' ').split('.')[0],
          result: data,
          frontImage: images.front,
          frontCrop: frontCropBase64,
          backImage: images.back,
          backCrop: backCropBase64,
        };
        if (data.hardware_identity !== 'Mismatch Detected') {
          setScanHistory(prev => [newHistoryItem, ...prev]);
        } else {
          console.warn("Mismatch detected. Aborting save.");
    }
      }
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const renderUploadCard = (side, title) => {
    const image = images[side];
    const crop = crops[side];
    const fileInputRef = side === 'front' ? fileInputRefFront : fileInputRefBack;

    return (
      <div className="glass-card">
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>{title}</h3>
        {!image ? (
          <div
            className="upload-zone"
            onDrop={handleDrop(side)}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            <p>Drag and drop an image here or click to upload</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect(side)}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => handleClear(side)}
              style={{
                marginBottom: '1rem',
                backgroundColor: 'transparent',
                color: '#d1d5db',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Clear Image
            </button>
            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrops(prev => ({ ...prev, [side]: newCrop }))}
              onComplete={(newCrop) => setCompletedCrops(prev => ({ ...prev, [side]: newCrop }))}
            >
              <img
                ref={side === 'front' ? imgRefFront : imgRefBack}
                src={image}
                alt={`${title} Upload`}
                style={{ maxWidth: '100%', maxHeight: '45vh', objectFit: 'contain' }}
              />
            </ReactCrop>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ textAlign: 'center' }}>

      {viewMode === 'recall' && recallItem ? (
        <>
          <button onClick={() => { setViewMode('scanner'); setRecallItem(null); }} style={{ marginBottom: '1rem', backgroundColor: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>← Return to Scanner</button>
          <div className="scanner-grid">
            <div className="glass-card">
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>Front View</h3>
              <img src={recallItem.frontImage} alt="Front View" style={{width: '100%', objectFit: 'contain', borderRadius: '8px'}} />
            </div>
            <div className="glass-card">
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>Back View</h3>
              <img src={recallItem.backImage} alt="Back View" style={{width: '100%', objectFit: 'contain', borderRadius: '8px'}} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-tab-row">
            <button
              className={`tab-button ${workspaceTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setWorkspaceTab('scanner')}
              type="button"
            >
              Scanner
            </button>
            <button
              className={`tab-button ${workspaceTab === 'recall' ? 'active' : ''}`}
              onClick={() => setWorkspaceTab('recall')}
              type="button"
            >
              Recall
            </button>
          </div>

          {workspaceTab === 'scanner' ? (
            <>
              <div className="scanner-grid">
                {renderUploadCard('front', 'Front View')}
                {renderUploadCard('back', 'Back View')}
              </div>
              <button
                className="button"
                onClick={handleScan}
                disabled={isScanning}
                style={{ marginTop: '1.5rem', opacity: isScanning ? 0.6 : 1, cursor: isScanning ? 'not-allowed' : 'pointer' }}
              >
                {isScanning ? 'Scanning Object...' : 'Execute Vision Scan'}
              </button>
            </>
          ) : (
            <div className="recall-placeholder">
              <p style={{ margin: 0 }}>
                Recall Workspace: Full Front/Back images will load here. You can add missing views here.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VisionScanner;