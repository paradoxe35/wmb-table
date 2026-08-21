import log from 'electron-log';

const POWER_REQUEST_CONTEXT_VERSION = 0;
const POWER_REQUEST_CONTEXT_SIMPLE_STRING = 0x1;
const POWER_REQUEST_EXECUTION_REQUIRED = 3;
const REASON = 'Reading a document aloud';

interface Kernel32 {
    PowerCreateRequest(context: unknown): unknown;
    PowerSetRequest(handle: unknown, requestType: number): boolean;
    PowerClearRequest(handle: unknown, requestType: number): boolean;
    CloseHandle(handle: unknown): boolean;
}

let kernel32: Kernel32 | null = null;
let requestHandle: unknown = null;
let unavailable = process.platform !== 'win32';

function loadKernel32(): Kernel32 {
    if (kernel32) return kernel32;

    // require, not import(): the main bundle is compiled to bytecode and runs through `vm`,
    // which has no dynamic import callback.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi');
    const lib = koffi.load('kernel32.dll');

    koffi.struct('REASON_CONTEXT', {
        Version: 'uint32',
        Flags: 'uint32',
        SimpleReasonString: 'str16',
    });

    kernel32 = {
        PowerCreateRequest: lib.func('void *PowerCreateRequest(REASON_CONTEXT *Context)'),
        PowerSetRequest: lib.func('bool PowerSetRequest(void *PowerRequest, int RequestType)'),
        PowerClearRequest: lib.func('bool PowerClearRequest(void *PowerRequest, int RequestType)'),
        CloseHandle: lib.func('bool CloseHandle(void *hObject)'),
    };
    return kernel32;
}

/**
 * Electron's blocker maps to ES_SYSTEM_REQUIRED, which only resets the idle timer: with the
 * display off, Modern Standby still throttles the CPU and stalls local voice synthesis. Only
 * PowerRequestExecutionRequired keeps the process running, and no Electron API reaches it.
 * Windows terminates it after 5 minutes on battery, so this holds on AC power.
 */
export function setExecutionRequest(active: boolean): void {
    if (unavailable) return;

    try {
        const api = loadKernel32();

        if (active) {
            if (requestHandle) return;

            const handle = api.PowerCreateRequest({
                Version: POWER_REQUEST_CONTEXT_VERSION,
                Flags: POWER_REQUEST_CONTEXT_SIMPLE_STRING,
                SimpleReasonString: REASON,
            });
            if (!handle) throw new Error('PowerCreateRequest returned null');

            if (!api.PowerSetRequest(handle, POWER_REQUEST_EXECUTION_REQUIRED)) {
                api.CloseHandle(handle);
                throw new Error('PowerSetRequest was refused');
            }

            requestHandle = handle;
            log.info('[power-save] execution request acquired');
            return;
        }

        if (!requestHandle) return;
        api.PowerClearRequest(requestHandle, POWER_REQUEST_EXECUTION_REQUIRED);
        api.CloseHandle(requestHandle);
        requestHandle = null;
        log.info('[power-save] execution request released');
    } catch (error) {
        unavailable = true;
        requestHandle = null;
        log.warn('[power-save] execution request unavailable', error);
    }
}
