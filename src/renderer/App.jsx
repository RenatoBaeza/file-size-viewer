import React, { useState, useEffect, useRef } from 'react';
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
  const hue = 200 - percentage * 1.5;
  return (
    <div className="size-bar-track">
      <div
        className="size-bar-fill"
        style={{
          width: `${Math.max(percentage, 0.5)}%`,
          backgroundColor: `hsl(${hue}, 75%, 58%)`,
        }}
      />
    </div>
  );
};

const ImagePreview = ({ path }) => (
  <div style={{
    position: 'fixed',
    zIndex: 1000,
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '6px',
    backgroundColor: '#18181b',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    pointerEvents: 'none',
  }}>
    <img
      src={`file://${path}`}
      style={{ maxWidth: '200px', maxHeight: '200px', display: 'block', borderRadius: '4px' }}
      alt="Preview"
    />
  </div>
);

const isImageFile = (filename) =>
  ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].some(ext =>
    filename.toLowerCase().endsWith(ext)
  );

function updateNodeInTree(contents, targetPath, newContents) {
  return contents.map(item => {
    if (item.path === targetPath) return { ...item, contents: newContents };
    if (item.isDirectory && item.contents)
      return { ...item, contents: updateNodeInTree(item.contents, targetPath, newContents) };
    return item;
  });
}

const FileTreeItem = ({ item, depth = 0, parentSize, onContract, onLoadContents }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });

  const paddingLeft = `${depth * 20}px`;
  const rowClass = `tree-row ${depth % 2 === 0 ? 'tree-row-even' : 'tree-row-odd'}`;

  const handleOpenInExplorer = async (e) => {
    e.stopPropagation();
    await ipcRenderer.invoke('open-in-explorer', item.path);
  };

  const handleMouseMove = (e) => {
    setPreviewPosition({ x: e.clientX + 14, y: e.clientY + 14 });
  };

  const handleContractAll = (e) => {
    e.stopPropagation();
    setIsExpanded(false);
    onContract?.();
  };

  const handleExpand = (value) => {
    setIsExpanded(value);
  };

  const handleToggleExpand = async () => {
    if (isExpanded) { setIsExpanded(false); return; }
    if (item.hasContents && !item.contents) {
      setIsLoading(true);
      try {
        const contents = await ipcRenderer.invoke('scan-subdirectory', item.path);
        onLoadContents?.(item.path, contents);
      } catch (err) {
        console.error('Error scanning subdirectory:', err);
      }
      setIsLoading(false);
    }
    setIsExpanded(true);
  };

  const isImage = !item.isDirectory && isImageFile(item.name);

  const renderDirectoryContents = () => {
    if (!item.contents) return null;

    const unfolderedFiles = item.contents.filter(c => !c.isDirectory);
    const folders = item.contents.filter(c => c.isDirectory);
    const unfolderedTotalSize = unfolderedFiles.reduce((s, f) => s + f.size, 0);
    const unfolderedGroup = unfolderedFiles.length > 0 && folders.length > 0
      ? { isUnfolderedGroup: true, files: unfolderedFiles, size: unfolderedTotalSize }
      : null;

    if (folders.length === 0) {
      return unfolderedFiles
        .sort((a, b) => b.size - a.size)
        .map(file => (
          <FileTreeItem
            key={file.path}
            item={file}
            depth={depth + 1}
            parentSize={item.size}
            onContract={handleExpand}
            onLoadContents={onLoadContents}
          />
        ));
    }

    const allItems = unfolderedGroup ? [...folders, unfolderedGroup] : [...folders];
    return allItems
      .sort((a, b) => b.size - a.size)
      .map(itemOrGroup =>
        itemOrGroup.isUnfolderedGroup ? (
          <UnfolderedFiles
            key="unfoldered"
            files={itemOrGroup.files}
            parentSize={item.size}
            depth={depth + 1}
            onContract={handleExpand}
          />
        ) : (
          <FileTreeItem
            key={itemOrGroup.path}
            item={itemOrGroup}
            depth={depth + 1}
            parentSize={item.size}
            onContract={handleExpand}
            onLoadContents={onLoadContents}
          />
        )
      );
  };

  if (item.isDirectory) {
    return (
      <>
        <div className={rowClass}>
          <div className="tree-cell-name">
            <div className="tree-cell-name-inner" style={{ paddingLeft }}>
              <span className="expand-btn" onClick={handleToggleExpand}>
                {isLoading ? '…' : isExpanded ? '▾' : '▸'}
              </span>
              <span className="item-name item-name-dir">📁 {item.name}</span>
            </div>
            {parentSize && <SizeBar size={item.size} parentSize={parentSize} />}
          </div>
          <div className="tree-cell-size">
            <span className="size-text">{formatSize(item.size)}</span>
            {parentSize && (
              <span className="pct-text">{((item.size / parentSize) * 100).toFixed(1)}%</span>
            )}
          </div>
          <div className="tree-cell-actions">
            <button className="btn-icon" onClick={handleOpenInExplorer} title="Open in Explorer">📂</button>
            <button className="btn-icon" onClick={handleContractAll} title="Collapse">⌃</button>
          </div>
        </div>
        {isExpanded && renderDirectoryContents()}
      </>
    );
  }

  return (
    <div className={rowClass}>
      <div className="tree-cell-name">
        <div className="tree-cell-name-inner" style={{ paddingLeft }}>
          <span
            className="item-name"
            onMouseEnter={() => isImage && setShowPreview(true)}
            onMouseLeave={() => isImage && setShowPreview(false)}
            onMouseMove={isImage ? handleMouseMove : undefined}
            style={{ cursor: isImage ? 'pointer' : 'default' }}
          >
            📄 {item.name}
          </span>
          {showPreview && isImage && (
            <div style={{ position: 'fixed', left: previewPosition.x, top: previewPosition.y }}>
              <ImagePreview path={item.path} />
            </div>
          )}
        </div>
        {parentSize && <SizeBar size={item.size} parentSize={parentSize} />}
      </div>
      <div className="tree-cell-size">
        <span className="size-text">{formatSize(item.size)}</span>
        {parentSize && (
          <span className="pct-text">{((item.size / parentSize) * 100).toFixed(1)}%</span>
        )}
      </div>
      <div className="tree-cell-actions">
        <button className="btn-icon" onClick={handleOpenInExplorer} title="Open in Explorer">📂</button>
      </div>
    </div>
  );
};

const UnfolderedFiles = ({ files, parentSize, depth = 0, onContract }) => {
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const paddingLeft = `${depth * 20}px`;

  const handleContractAll = (e) => {
    e.stopPropagation();
    setIsExpanded(false);
    onContract?.(false);
  };

  if (files.length === 0) return null;

  return (
    <>
      <div className="tree-row tree-row-even">
        <div className="tree-cell-name">
          <div className="tree-cell-name-inner" style={{ paddingLeft }}>
            <span className="expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? '▾' : '▸'}
            </span>
            <span className="item-name item-name-unfoldered">
              📑 Unfoldered Files ({files.length})
            </span>
          </div>
          {parentSize && <SizeBar size={totalSize} parentSize={parentSize} />}
        </div>
        <div className="tree-cell-size">
          <span className="size-text">{formatSize(totalSize)}</span>
          {parentSize && (
            <span className="pct-text">{((totalSize / parentSize) * 100).toFixed(1)}%</span>
          )}
        </div>
        <div className="tree-cell-actions">
          <button className="btn-icon" onClick={handleContractAll} title="Collapse">⌃</button>
        </div>
      </div>
      {isExpanded && files
        .sort((a, b) => b.size - a.size)
        .map(file => (
          <FileTreeItem
            key={file.path}
            item={file}
            depth={depth + 1}
            parentSize={totalSize}
            onContract={() => setIsExpanded(false)}
          />
        ))}
    </>
  );
};

const ScanLog = ({ progress }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progress]);

  if (!progress) return null;

  return (
    <div className="scan-log">
      <div className="scan-log-header">
        <span className="scan-log-scanning">◉ SCANNING</span>
        <span>📁 <strong className="scan-log-count">{progress.dirs.toLocaleString()}</strong> folders</span>
        <span>📄 <strong className="scan-log-count">{progress.files.toLocaleString()}</strong> files</span>
      </div>
      <div ref={logRef} className="scan-log-body">
        {progress.logs.map((entry, i) => (
          <div
            key={i}
            className={`scan-log-entry ${i === progress.logs.length - 1 ? 'scan-log-entry-active' : 'scan-log-entry-normal'}`}
          >
            <span className="scan-log-dir-icon">{entry.type === 'dir' ? '▶' : ' '}</span>
            {entry.path}
          </div>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  const [folderData, setFolderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);

  useEffect(() => {
    const handleProgress = (event, data) => {
      setScanProgress(prev => {
        const newEntry = { path: data.currentPath, type: data.dirs > (prev?.dirs ?? 0) ? 'dir' : 'file' };
        const newLogs = prev ? [...prev.logs, newEntry].slice(-200) : [newEntry];
        return { files: data.files, dirs: data.dirs, logs: newLogs };
      });
    };
    ipcRenderer.on('scan-progress', handleProgress);
    return () => ipcRenderer.removeListener('scan-progress', handleProgress);
  }, []);

  const handleLoadContents = (targetPath, newContents) => {
    setFolderData(prev => ({
      ...prev,
      contents: updateNodeInTree(prev.contents, targetPath, newContents),
    }));
  };

  const handleSelectFolder = async () => {
    setScanProgress(null);
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('select-directory');
      if (result) setFolderData(result);
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
    setLoading(false);
    setScanProgress(null);
  };

  const renderContents = () => {
    if (!folderData?.contents) return null;

    const unfolderedFiles = folderData.contents.filter(i => !i.isDirectory);
    const folders = folderData.contents.filter(i => i.isDirectory);
    const totalSize = folderData.contents.reduce((s, i) => s + i.size, 0);
    const unfolderedTotalSize = unfolderedFiles.reduce((s, f) => s + f.size, 0);
    const unfolderedGroup = unfolderedFiles.length > 0 && folders.length > 0
      ? { isUnfolderedGroup: true, files: unfolderedFiles, size: unfolderedTotalSize }
      : null;

    if (folders.length === 0) {
      return unfolderedFiles
        .sort((a, b) => b.size - a.size)
        .map(file => (
          <FileTreeItem
            key={file.path}
            item={file}
            parentSize={totalSize}
            onLoadContents={handleLoadContents}
          />
        ));
    }

    const allItems = unfolderedGroup ? [...folders, unfolderedGroup] : [...folders];
    return allItems
      .sort((a, b) => b.size - a.size)
      .map(itemOrGroup =>
        itemOrGroup.isUnfolderedGroup ? (
          <UnfolderedFiles
            key="unfoldered"
            files={itemOrGroup.files}
            parentSize={totalSize}
          />
        ) : (
          <FileTreeItem
            key={itemOrGroup.path}
            item={itemOrGroup}
            parentSize={totalSize}
            onLoadContents={handleLoadContents}
          />
        )
      );
  };

  const totalSize = folderData?.contents?.reduce((s, i) => s + i.size, 0) ?? 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <span className="app-icon">🗂</span>
        <div>
          <h1 className="app-title">File Size Viewer</h1>
          <div className="app-tagline">Visualize disk usage at a glance</div>
        </div>
      </header>

      <button className="btn-primary" onClick={handleSelectFolder} disabled={loading}>
        {loading ? '⏳ Scanning…' : '📂 Select Folder'}
      </button>

      {loading && <ScanLog progress={scanProgress} />}

      {folderData && (
        <div>
          <div className="folder-info">
            <h2 className="folder-path">{folderData.path}</h2>
            <span className="size-badge">{formatSize(totalSize)}</span>
          </div>
          <div className="tree-container">
            <div className="tree-header">
              <div>Name</div>
              <div style={{ textAlign: 'right' }}>Size</div>
              <div style={{ textAlign: 'center' }}>Actions</div>
            </div>
            {renderContents()}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
