import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // API will be populated in Phase 2
});
