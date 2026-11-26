export const SENTRY_DSN =
    'https://f265e8b9f29ae32939a050e20f5ad0d9@o4505023577325568.ingest.us.sentry.io/4511024242950144';

/**
 * Sentry 8 (JS SDK v11) collects user info, headers, bodies, AI prompts and
 * query data by default. Error reports only carry technical context
 * (see docs/privacy.md), so all of that stays off. Users' AI API keys travel
 * in request headers and their chats in request bodies.
 */
export const SENTRY_DATA_COLLECTION = {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: true,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
};
