import { app } from 'electron';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { resolveUiLanguage } from '@shared/constants';
import { initializeDatabase, closeDatabase } from '@main/database';
import * as configRepo from '@main/database/repositories/config.repository';
import {
    initializeTantivy,
    getInstalledLanguages,
    terminateWorker,
} from '@main/services/tantivy.service';
import { createLibraryMcpServer } from '@main/services/mcp/library-mcp-server';
import { startMcpHttpServer } from '@main/services/mcp/mcp-http-server';
import { NoFreePortError } from '@main/services/mcp/listen-on-free-port';
import { loadMcpSettings } from '@main/services/mcp/mcp-settings';
import i18n from '@main/lib/i18n';
import log, { initializeCliLogger } from '@main/lib/logger';
import { RELAUNCHED_ENV, type McpCliCommand } from './command-line';

const SERVER_STOP_TIMEOUT_MS = 2_000;
const PARENT_CHECK_INTERVAL_MS = 1_000;
const SETTINGS_CHECK_INTERVAL_MS = 2_000;

/** An expected refusal: only its message is shown, without a stack trace. */
class CliExit extends Error {}

interface RunningTransport {
    close(): Promise<void>;
}

function applyUiLanguage(): void {
    const config = configRepo.getConfig();
    void i18n.changeLanguage(resolveUiLanguage(config?.uiLanguage, config?.contentLanguage));
}

function disabledMessage(): string {
    return i18n.t(
        'Le serveur MCP est désactivé. Activez « Serveur MCP » dans Wmb Table → Paramètres → Assistant.',
    );
}

function ensureEnabled(): void {
    if (!loadMcpSettings().enabled) throw new CliExit(disabledMessage());
}

function ensureLanguageInstalled(language: string | undefined): void {
    const installed = getInstalledLanguages();
    if (!language || installed.includes(language)) return;
    throw new CliExit(
        i18n.t(
            'La langue « {{language}} » n’est pas installée dans Wmb Table. Installées : {{installed}}.',
            {
                language,
                installed: installed.join(', ') || '—',
            },
        ),
    );
}

function libraryServerFactory(command: McpCliCommand) {
    return () =>
        createLibraryMcpServer({
            allowWrites: loadMcpSettings().allowWrites,
            version: app.getVersion(),
            contentLanguage: command.language,
        });
}

function serveOverStdio(command: McpCliCommand, onClosed: () => void): RunningTransport {
    process.stdin.once('end', onClosed);
    process.stdin.once('close', onClosed);
    return serveStdio(libraryServerFactory(command), {
        transport: new StdioServerTransport(),
        onerror: (error) => log.warn('[mcp-cli] stdio error:', error),
    });
}

async function serveOverHttp(command: McpCliCommand): Promise<RunningTransport> {
    try {
        const server = await startMcpHttpServer({
            firstPort: command.port ?? loadMcpSettings().port,
            portAttempts: command.port ? 1 : undefined,
            createServer: libraryServerFactory(command),
            refusal: () => (loadMcpSettings().enabled ? null : disabledMessage()),
        });
        process.stdout.write(
            `${i18n.t('Serveur MCP de Wmb Table : {{url}}', { url: server.url })}\n`,
        );
        return server;
    } catch (error) {
        if (!(error instanceof NoFreePortError)) throw error;
        throw new CliExit(
            error.firstPort === error.lastPort
                ? i18n.t(
                      'Le port {{port}} est déjà utilisé (Wmb Table sert peut-être déjà cette adresse).',
                      {
                          port: error.firstPort,
                      },
                  )
                : i18n.t('Les ports {{firstPort}} à {{lastPort}} sont déjà utilisés.', {
                      firstPort: error.firstPort,
                      lastPort: error.lastPort,
                  }),
        );
    }
}

/** When the relaunching parent is killed, its child is adopted by another process. */
function stopWhenParentDies(stop: () => void): void {
    if (!process.env[RELAUNCHED_ENV]) return;
    const parentPid = process.ppid;
    setInterval(() => {
        if (process.ppid !== parentPid) stop();
    }, PARENT_CHECK_INTERVAL_MS).unref();
}

/** A stdio session has no request to refuse, so unticking « Serveur MCP » ends it. */
function stopWhenDisabled(stop: () => void): void {
    const timer = setInterval(() => {
        if (loadMcpSettings().enabled) return;
        clearInterval(timer);
        process.stderr.write(`${disabledMessage()}\n`);
        stop();
    }, SETTINGS_CHECK_INTERVAL_MS);
    timer.unref();
}

async function closeWithTimeout(transport: RunningTransport | null): Promise<void> {
    if (!transport) return;
    await Promise.race([
        transport.close().catch((error) => log.warn('[mcp-cli] Stop failed:', error)),
        new Promise((resolve) => setTimeout(resolve, SERVER_STOP_TIMEOUT_MS)),
    ]);
}

/**
 * `wmb-table mcp`: the library served to an AI app without a window. The app may be open at
 * the same time on the same data: SQLite runs in WAL mode and the sermon indexes are only read.
 */
export function runMcpCommand(command: McpCliCommand): void {
    initializeCliLogger();
    app.dock?.hide();

    let transport: RunningTransport | null = null;
    let stopping: Promise<void> | null = null;

    const stop = (code = 0): Promise<void> => {
        stopping ??= (async () => {
            await closeWithTimeout(transport);
            await terminateWorker();
            closeDatabase();
            log.info('[mcp-cli] Stopped');
            app.exit(code);
        })();
        return stopping;
    };

    const fail = (error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        if (!(error instanceof CliExit)) log.error('[mcp-cli] Failed:', error);
        void stop(1);
    };

    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        process.on(signal, () => void stop());
    }
    app.on('will-quit', (event) => {
        if (stopping) return;
        event.preventDefault();
        void stop();
    });
    stopWhenParentDies(() => void stop());

    const start = async (): Promise<void> => {
        initializeDatabase();
        applyUiLanguage();
        ensureEnabled();
        await app.whenReady();
        await initializeTantivy();
        ensureLanguageInstalled(command.language);
        if (command.transport === 'stdio') {
            transport = serveOverStdio(command, () => void stop());
            stopWhenDisabled(() => void stop());
        } else {
            transport = await serveOverHttp(command);
        }
        log.info(`[mcp-cli] Serving over ${command.transport}`);
    };
    start().catch(fail);
}
