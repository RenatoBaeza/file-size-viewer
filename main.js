// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('fs/promises')

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
      size: fstats.size
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

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// IPC handlers
ipcMain.handle('select-directory', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
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

ipcMain.handle('scan-subdirectory', async (event, dirPath) => {
  const contents = await scanDirectory(dirPath);
  return contents;
});

ipcMain.handle('open-in-explorer', async (event, path) => {
  await shell.openPath(path);
  return true;
});

ipcMain.handle('delete-item', async (event, itemPath, isDirectory) => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Confirm Deletion',
    message: `Are you sure you want to delete this ${isDirectory ? 'folder' : 'file'}?`,
    detail: itemPath,
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
  });

  if (result.response === 1) {
    try {
      if (isDirectory) {
        await fs.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.unlink(itemPath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.