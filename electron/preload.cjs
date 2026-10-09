// The page-side half of the characters folder: exposes `window.rpFiles` (only in the desktop app - in a plain
// browser it's undefined and src/store.js falls back to localStorage).
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => {
  const r = ipcRenderer.sendSync(channel, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

contextBridge.exposeInMainWorld('rpFiles', {
  folder: () => call('chars:folder'),
  loadAll: () => call('chars:loadAll'),
  save: (ch, currentFile) => call('chars:save', ch, currentFile || null),
  remove: (file) => ipcRenderer.invoke('chars:remove', file),
  openFolder: () => ipcRenderer.invoke('chars:openFolder'),
});

// descriptions read from the user's own rulebook PDFs, and their own edits to descriptions (electron/rulebook.cjs)
contextBridge.exposeInMainWorld('rpRulebook', {
  load: () => call('rulebook:load'),
  saveEdits: (edits) => call('rulebook:saveEdits', edits),
  forget: () => call('rulebook:forget'),
  chooseFolder: (current) => ipcRenderer.invoke('rulebook:chooseFolder', current || ''),
  read: (folder) => ipcRenderer.invoke('rulebook:read', folder || ''),
  cancel: () => ipcRenderer.invoke('rulebook:cancel'),
  onProgress: (fn) => {
    const h = (_e, msg) => fn(msg);
    ipcRenderer.on('rulebook:progress', h);
    return () => ipcRenderer.removeListener('rulebook:progress', h);
  },
});
