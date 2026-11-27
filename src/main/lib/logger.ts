import log from 'electron-log/main.js';

export const CLI_LOG_FILE = 'mcp.log';

export function initializeLogger(): void {
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB

    // Override console methods so all logs go through electron-log
    log.initialize();
}

function writeToStderr(...data: unknown[]): void {
    console.error(...data);
}

/**
 * In `wmb-table mcp`, stdout carries the MCP messages: one stray line breaks the client, so
 * every console method and the log's console output go to stderr instead.
 */
export function keepStdoutForMcp(): void {
    console.log = writeToStderr;
    console.info = writeToStderr;
    console.debug = writeToStderr;
    console.trace = writeToStderr;
    console.dir = writeToStderr;
    console.table = writeToStderr;
}

/** The command-line modes log to their own file, so they never interleave with the app's log. */
export function initializeCliLogger(): void {
    log.transports.file.level = 'info';
    log.transports.file.fileName = CLI_LOG_FILE;
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.console.level = 'warn';
    log.transports.console.writeFn = ({ message }) => writeToStderr(...message.data);
}

export default log;
