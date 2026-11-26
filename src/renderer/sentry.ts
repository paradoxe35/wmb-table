import * as Sentry from '@sentry/electron/renderer';
import { SENTRY_DATA_COLLECTION, SENTRY_DSN } from '@shared/sentry';

Sentry.init({
    dsn: SENTRY_DSN,
    dataCollection: SENTRY_DATA_COLLECTION,
});
