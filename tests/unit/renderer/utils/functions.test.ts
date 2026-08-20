import { describe, expect, it } from 'vitest';
import { formatTime, getErrorMessage } from '@renderer/utils/functions';

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

describe('formatTime', () => {
    it('omits the hour for durations under an hour', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(8)).toBe('0:08');
        expect(formatTime(2648)).toBe('44:08');
        expect(formatTime(3599)).toBe('59:59');
    });

    it('rolls over into hours instead of counting past 59 minutes', () => {
        expect(formatTime(3600)).toBe('1:00:00');
        expect(formatTime(5521)).toBe('1:32:01');
        expect(formatTime(9391)).toBe('2:36:31');
    });

    it('zero-pads minutes only once an hour is shown', () => {
        expect(formatTime(305)).toBe('5:05');
        expect(formatTime(3905)).toBe('1:05:05');
    });

    it('truncates fractional seconds', () => {
        expect(formatTime(59.9)).toBe('0:59');
    });

    it('falls back for values that cannot be shown', () => {
        expect(formatTime(NaN)).toBe('0:00');
        expect(formatTime(Infinity)).toBe('0:00');
        expect(formatTime(-5)).toBe('0:00');
    });
});
