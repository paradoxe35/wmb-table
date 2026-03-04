import log from 'electron-log/main';

export function initializeLogger(): void {
  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB

  // Override console methods so all logs go through electron-log
  log.initialize();
}

export default log;
