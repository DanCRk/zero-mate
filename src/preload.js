'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const listener = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('host', {
  onHookEvent: on('hook:event'),
  onCommand: on('yorha:command'),
  onConfig: on('yorha:config'),
  onTheme: on('yorha:theme'),
  onResize: on('overlay:resize'),
  onWindows: on('windows:update'),
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', Boolean(on)),
  setFocusable: (on) => ipcRenderer.send('overlay:focusable', Boolean(on)),
  cursor: () => ipcRenderer.invoke('overlay:cursor'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  listThemes: () => ipcRenderer.invoke('theme:list'),
  transcribePcm16k: (floatArray) => ipcRenderer.invoke('stt:transcribe', floatArray),
  askBrain: (prompt, opts) => ipcRenderer.invoke('brain:ask', prompt, opts),
  listBrains: () => ipcRenderer.invoke('brain:providers'),
  onRequestPermission: on('tool:request-permission'),
  sendToolDecision: (id, decision) => ipcRenderer.send('tool:decision', { id, decision }),
  runTool: (name, params) => ipcRenderer.invoke('tool:run', name, params),
});
