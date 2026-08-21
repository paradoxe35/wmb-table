import { describe, it, expect, vi } from 'vitest';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));

describe('execution request on a non-Windows platform', () => {
    it('never loads the Windows library', async () => {
        const koffi = vi.fn();
        vi.doMock('koffi', () => ({ default: { load: koffi, struct: vi.fn() } }));

        const { setExecutionRequest } = await import('@main/services/execution-request.service');
        setExecutionRequest(true);
        setExecutionRequest(false);
        await new Promise((r) => setTimeout(r, 20));

        expect(koffi).not.toHaveBeenCalled();
    });
});
