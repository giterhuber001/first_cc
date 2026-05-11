const { app, BrowserWindow, Tray, ipcMain, nativeImage, Menu } = require('electron');
const path = require('path');
const store = require('./notes-store');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createTrayIcon() {
  // Generate a simple 16x16 tray icon (a warm amber dot/pen marker)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - 8, cy = y - 8;
      const d = Math.sqrt(cx * cx + cy * cy);
      // Filled circle with slight gradient
      if (d <= 6) {
        canvas[i] = 240;     // R
        canvas[i + 1] = 160; // G
        canvas[i + 2] = 80;  // B
        canvas[i + 3] = 255; // A
      } else if (d <= 7) {
        canvas[i] = 200;
        canvas[i + 1] = 130;
        canvas[i + 2] = 60;
        canvas[i + 3] = 200;
      } else {
        canvas[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 500,
    minHeight: 400,
    title: '每日速记',
    backgroundColor: '#1b1b2f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('每日速记');
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// IPC handlers
ipcMain.handle('notes:get-date', (_event, dateStr) => {
  return store.getNotes(dateStr);
});

ipcMain.handle('notes:add-note', (_event, dateStr, text) => {
  return store.addNote(dateStr, text);
});

ipcMain.handle('notes:update-note', (_event, dateStr, index, text) => {
  return store.updateNote(dateStr, index, text);
});

ipcMain.handle('notes:delete-note', (_event, dateStr, index) => {
  store.deleteNote(dateStr, index);
});

ipcMain.handle('notes:search', (_event, keyword) => {
  return store.searchNotes(keyword);
});

ipcMain.handle('notes:list-months', () => {
  return store.listMonths();
});

ipcMain.handle('notes:root-dir', () => {
  return store.rootDir();
});

// Store all Electron user data (cache, GPU cache, etc.) inside the project
app.setPath('userData', path.join(__dirname, '.electron-data'));

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // On Windows, don't quit — tray keeps running
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
