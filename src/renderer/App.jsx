import React, { useState } from 'react';
const { ipcRenderer } = window.require('electron');

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

const SizeBar = ({ size, parentSize }) => {
  const percentage = (size / parentSize) * 100;
  const hue = 200 - (percentage * 1.5); // Color goes from blue (200) to red (20) as percentage increases
  
  return (
    <div style={{
      width: '100%',
      height: '4px',
      backgroundColor: '#eee',
      borderRadius: '2px',
      overflow: 'hidden',
      marginTop: '4px'
    }}>
      <div style={{
        width: `${Math.max(percentage, 0.5)}%`,
        height: '100%',
        backgroundColor: `hsl(${hue}, 80%, 50%)`,
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
};

const ImagePreview = ({ path }) => {
  return (
    <div style={{
      position: 'fixed',
      zIndex: 1000,
      border: '2px solid #ccc',
      borderRadius: '4px',
      padding: '4px',
      backgroundColor: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      pointerEvents: 'none'
    }}>
      <img 
        src={`file://${path}`} 
        style={{
          maxWidth: '200px',
          maxHeight: '200px',
          display: 'block'
        }}
        alt="Preview"
      />
    </div>
  );
};

const isImageFile = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

const FileTreeItem = ({ item, depth = 0, parentSize }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const paddingLeft = `${depth * 20}px`;

  const handleOpenInExplorer = async (e) => {
    e.stopPropagation();
    await ipcRenderer.invoke('open-in-explorer', item.path);
  };

  const handleMouseMove = (e) => {
    setPreviewPosition({
      x: e.clientX + 10,
      y: e.clientY + 10
    });
  };

  const isImage = !item.isDirectory && isImageFile(item.name);

  return (
    <>
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 80px',
          gap: '10px',
          padding: '8px',
          backgroundColor: depth % 2 === 0 ? '#ffffff' : '#f9f9f9',
          borderBottom: '1px solid #eee',
        }}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft
          }}>
            {item.isDirectory && (
              <span 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ 
                  cursor: 'pointer',
                  marginRight: '5px',
                  userSelect: 'none'
                }}
              >
                {isExpanded ? '🔽' : '▶️'}
              </span>
            )}
            <span
              onMouseEnter={() => isImage && setShowPreview(true)}
              onMouseLeave={() => isImage && setShowPreview(false)}
              onMouseMove={isImage ? handleMouseMove : undefined}
              style={{ cursor: isImage ? 'pointer' : 'default' }}
            >
              {item.isDirectory ? '📁' : '📄'} {item.name}
            </span>
            {showPreview && isImage && (
              <div style={{ position: 'relative' }}>
                <div style={{ 
                  position: 'fixed',
                  left: `${previewPosition.x}px`,
                  top: `${previewPosition.y}px`
                }}>
                  <ImagePreview path={item.path} />
                </div>
              </div>
            )}
          </div>
          {parentSize && <SizeBar size={item.size} parentSize={parentSize} />}
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          <div>{formatSize(item.size)}</div>
          {parentSize && (
            <div style={{ 
              fontSize: '0.8em', 
              color: '#666',
              marginTop: '4px'
            }}>
              {((item.size / parentSize) * 100).toFixed(1)}%
            </div>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleOpenInExplorer}
            title="Open in Explorer"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              opacity: 0.6,
              transition: 'all 0.2s',
              ':hover': {
                opacity: 1,
                backgroundColor: '#f0f0f0'
              }
            }}
          >
            📂
          </button>
        </div>
      </div>
      
      {item.isDirectory && isExpanded && item.contents && (
        <div>
          {item.contents
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) {
                return b.isDirectory ? 1 : -1;
              }
              return b.size - a.size;
            })
            .map((child) => (
              <FileTreeItem 
                key={child.path} 
                item={child} 
                depth={depth + 1}
                parentSize={item.size}
              />
            ))}
        </div>
      )}
    </>
  );
};

const App = () => {
  const [folderData, setFolderData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('select-directory');
      if (result) {
        setFolderData(result);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>File Size Viewer</h1>
      
      <button 
        onClick={handleSelectFolder}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          marginBottom: '20px',
          cursor: loading ? 'wait' : 'pointer',
          backgroundColor: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          transition: 'background-color 0.3s'
        }}
      >
        {loading ? 'Scanning...' : 'Select Folder'}
      </button>

      {folderData && (
        <div>
          <h2>Selected Folder: {folderData.path}</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 120px 80px',
            gap: '10px',
            backgroundColor: '#f5f5f5',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            <div>Name</div>
            <div style={{ textAlign: 'right' }}>Size</div>
            <div style={{ textAlign: 'center' }}>Actions</div>
          </div>
          <div style={{ 
            border: '1px solid #eee',
            borderRadius: '5px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            {folderData.contents
              .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                  return b.isDirectory ? 1 : -1;
                }
                return b.size - a.size;
              })
              .map((item) => (
                <FileTreeItem 
                  key={item.path} 
                  item={item} 
                  parentSize={folderData.contents.reduce((sum, item) => sum + item.size, 0)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 