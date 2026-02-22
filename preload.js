const { contextBridge, ipcRenderer } = require('electron');

const INVOKE_CHANNELS = ['select-directory', 'scan-subdirectory', 'open-in-explorer', 'delete-item'];
const RECEIVE_CHANNELS = ['scan-progress'];

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () =>
    ipcRenderer.invoke('select-directory'),

  scanSubdirectory: (dirPath) => {
    if (typeof dirPath !== 'string') throw new TypeError('dirPath must be a string');
    return ipcRenderer.invoke('scan-subdirectory', dirPath);
  },

  openInExplorer: (itemPath) => {
    if (typeof itemPath !== 'string') throw new TypeError('path must be a string');
    return ipcRenderer.invoke('open-in-explorer', itemPath);
  },

  deleteItem: (itemPath, isDirectory) => {
    if (typeof itemPath !== 'string') throw new TypeError('path must be a string');
    return ipcRenderer.invoke('delete-item', itemPath, Boolean(isDirectory));
  },

  onScanProgress: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },
});
