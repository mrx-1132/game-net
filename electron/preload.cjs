const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('remoteBridge', {
  pushState: (s) => ipcRenderer.send('remote:state', s),
  reply: (r) => ipcRenderer.send('remote:reply', r),
  onCommand: (cb) => {
    const h = (_e, c) => cb(c);
    ipcRenderer.on('remote:cmd', h);
    return () => ipcRenderer.removeListener('remote:cmd', h);
  },
  getInfo: () => ipcRenderer.invoke('remote:info'),
  newPairCode: () => ipcRenderer.invoke('remote:pair-code'),
  listDevices: () => ipcRenderer.invoke('remote:devices'),
  revokeDevice: (id) => ipcRenderer.invoke('remote:revoke', id),
});

contextBridge.exposeInMainWorld('licenseBridge', {
  status: () => ipcRenderer.invoke('license:status'),
  activate: (username, password) => ipcRenderer.invoke('license:activate', username, password),
  refresh: () => ipcRenderer.invoke('license:refresh'),
  logout: () => ipcRenderer.invoke('license:logout'),
  onChange: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('license:changed', h);
    return () => ipcRenderer.removeListener('license:changed', h);
  },
});
