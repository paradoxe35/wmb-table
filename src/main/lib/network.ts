import { net, session } from 'electron';

const CONNECTIVITY_TIMEOUT_MS = 5_000;
const CONNECTIVITY_URL = 'http://clients3.google.com/generate_204';

/**
 * Real internet connectivity check — pings Google's generate_204 endpoint.
 * Returns true only if we get a successful HTTP response (not just a connected WiFi).
 */
export async function hasInternet(): Promise<boolean> {
    if (!net.isOnline()) return false;

    try {
        const response = await net.fetch(CONNECTIVITY_URL, {
            signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
            session: session.defaultSession,
        });
        return response.status === 204;
    } catch {
        return false;
    }
}
