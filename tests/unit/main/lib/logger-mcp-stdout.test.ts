import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import log, { CLI_LOG_FILE, initializeCliLogger, keepStdoutForMcp } from '@main/lib/logger';

const originalConsole = { ...console };
let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;

/** console.error is what writes to stderr; the spy also keeps the test output clean. */
beforeEach(() => {
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    log.transports.file.level = false;
});

afterEach(() => {
    Object.assign(console, originalConsole);
    vi.restoreAllMocks();
});

describe('MCP stdio mode', () => {
    it('sends every console method to stderr', () => {
        keepStdoutForMcp();
        console.log('log');
        console.info('info');
        console.debug('debug');
        console.trace('trace');
        console.dir({ dir: true });
        console.table([{ a: 1 }]);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).toHaveBeenCalledTimes(6);
    });

    it('writes the log console output to stderr at every level', () => {
        initializeCliLogger();
        log.transports.file.level = false;
        log.transports.console.level = 'silly';
        log.info('info line');
        log.warn('warn line');
        log.error('error line');
        log.debug('debug line');
        const written = stderr.mock.calls.map((args) => args.join(' ')).join('\n');
        expect(stdout).not.toHaveBeenCalled();
        expect(written).toContain('info line');
        expect(written).toContain('error line');
    });

    it('logs to its own file, apart from the open app', () => {
        initializeCliLogger();
        expect(log.transports.file.fileName).toBe(CLI_LOG_FILE);
        expect(log.transports.console.level).toBe('warn');
    });
});
