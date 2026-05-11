const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  getNotes: (dateStr) => ipcRenderer.invoke('notes:get-date', dateStr),
  addNote: (dateStr, text) => ipcRenderer.invoke('notes:add-note', dateStr, text),
  updateNote: (dateStr, index, text) => ipcRenderer.invoke('notes:update-note', dateStr, index, text),
  deleteNote: (dateStr, index) => ipcRenderer.invoke('notes:delete-note', dateStr, index),
  searchNotes: (keyword) => ipcRenderer.invoke('notes:search', keyword),
  listMonths: () => ipcRenderer.invoke('notes:list-months'),
  getRootDir: () => ipcRenderer.invoke('notes:root-dir'),
});
