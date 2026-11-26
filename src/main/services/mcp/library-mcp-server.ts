import { McpServer } from '@modelcontextprotocol/server';
import { buildToolExecutors } from '@main/services/ai/tools';
import * as bibleService from '@main/services/bible.service';
import * as tantivyService from '@main/services/tantivy.service';
import * as configRepo from '@main/database/repositories/config.repository';
import { MCP_SERVER_NAME } from '@shared/mcp.types';
import { registerAiTools, selectExposedTools } from './ai-tool-adapter';

export interface LibraryMcpServerOptions {
    allowWrites: boolean;
    version: string;
}

/** Read on every request, so a language changed in the app applies to the next tool call. */
function resolveContentLanguage(): string {
    return configRepo.getContentLanguage() ?? tantivyService.getInstalledLanguages()[0] ?? 'en';
}

function describeLibrary(contentLanguage: string, allowWrites: boolean): string {
    const access = allowWrites
        ? 'The tools can also create and change notes and subjects.'
        : 'The tools only read; notes and subjects cannot be changed.';
    return [
        "Wmb Table is the user's library of William Branham's sermons, Bibles, their own documents, notes and subjects.",
        `Tools default to the content language "${contentLanguage}"; pass languageCode for another installed language.`,
        access,
    ].join(' ');
}

export function createLibraryMcpServer(options: LibraryMcpServerOptions): McpServer {
    const contentLanguage = resolveContentLanguage();
    const bibleVersion = bibleService.getResolvedBibleVersionForLanguage(
        contentLanguage,
        configRepo.getActiveBibleVersionAbbreviation(),
    );
    const server = new McpServer(
        { name: MCP_SERVER_NAME, version: options.version },
        { instructions: describeLibrary(contentLanguage, options.allowWrites) },
    );
    const tools = buildToolExecutors(contentLanguage, bibleVersion?.abbreviation);
    registerAiTools(server, selectExposedTools(tools, options.allowWrites));
    return server;
}
