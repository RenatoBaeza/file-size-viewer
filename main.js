const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('fs/promises');

// Surface unhandled promise rejections so they don't fail silently
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason);
});

async function getDirectorySize(dirPath) {
  let size = 0;
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      size += await getDirectorySize(fullPath);
    } else {
      const stats = await fs.stat(fullPath);
      size += stats.size;
    }
  }
  return size;
}

async function scanDirectory(dirPath, progressCallback, stats = { files: 0, dirs: 0 }) {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const fstats = await fs.stat(fullPath);
    const entry = {
      name: item.name,
      path: fullPath,
      isDirectory: item.isDirectory(),
      size: fstats.size,
    };

    if (item.isDirectory()) {
      stats.dirs++;
      if (progressCallback) progressCallback({ files: stats.files, dirs: stats.dirs, currentPath: fullPath });
      entry.size = await getDirectorySize(fullPath);
      entry.hasContents = true;
    } else {
      stats.files++;
      if (progressCallback && stats.files % 50 === 0) {
        progressCallback({ files: stats.files, dirs: stats.dirs, currentPath: fullPath });
      }
    }

    results.push(entry);
  }

  return results;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox is true by default in Electron 20+; preload uses only
      // contextBridge/ipcRenderer which are allowed in sandboxed preloads
    },
  });

  mainWindow.loadFile('index.html');

  // Only open DevTools when not running as a packaged/production build
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Block the renderer from navigating away from the app's origin.
  // This prevents malicious content from redirecting to an external URL
  // and gaining elevated privileges.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appURL = new URL(mainWindow.webContents.getURL());
    const targetURL = new URL(url);
    if (targetURL.origin !== appURL.origin && targetURL.protocol !== 'file:') {
      event.preventDefault();
    }
  });

  // Block new windows opened by the renderer (e.g. window.open)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// --- IPC Handlers ---

ipcMain.handle('select-directory', async (event) => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });

  if (!result.canceled) {
    const dirPath = result.filePaths[0];
    const progressCallback = (data) => {
      event.sender.send('scan-progress', data);
    };
    const contents = await scanDirectory(dirPath, progressCallback);
    return { path: dirPath, contents };
  }
  return null;
});

ipcMain.handle('scan-subdirectory', async (_event, dirPath) => {
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    throw new Error('Invalid dirPath argument');
  }
  const normalized = path.normalize(dirPath);
  return scanDirectory(normalized);
});

ipcMain.handle('open-in-explorer', async (_event, itemPath) => {
  if (typeof itemPath !== 'string' || !itemPath.trim()) {
    throw new Error('Invalid path argument');
  }
  await shell.openPath(path.normalize(itemPath));
  return true;
});

ipcMain.handle('delete-item', async (_event, itemPath, isDirectory) => {
  if (typeof itemPath !== 'string' || !itemPath.trim()) {
    throw new Error('Invalid path argument');
  }

  const normalized = path.normalize(itemPath);
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Send to Recycle Bin',
    message: `Send this ${isDirectory ? 'folder' : 'file'} to the Recycle Bin?`,
    detail: normalized,
    buttons: ['Cancel', 'Send to Recycle Bin'],
    defaultId: 0,
    cancelId: 0,
  });

  if (result.response === 1) {
    try {
      await shell.trashItem(normalized);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// --- App lifecycle ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
