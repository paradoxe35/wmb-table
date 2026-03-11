import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '@renderer/utils/functions';

describe('getErrorMessage', () => {
    it('unwraps remote method wrapper messages', () => {
        const err = new Error(
            "Error invoking remote method 'tts:previewVoice': OpenAI API key not configured",
        );

        expect(getErrorMessage(err)).toBe('OpenAI API key not configured');
    });

    it('unwraps remote function wrapper messages from object-like errors', () => {
        expect(
            getErrorMessage({
                message: 'Error invoking remote function tts:previewVoice: Voice preview failed',
            }),
        ).toBe('Voice preview failed');
    });

    it('keeps ordinary error messages unchanged', () => {
        expect(getErrorMessage(new Error('Something else failed'))).toBe('Something else failed');
    });
});
