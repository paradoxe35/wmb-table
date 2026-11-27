// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@renderer/i18n';
import ChatToolResult from '@renderer/views/options/ai-chat/chat-tool-result';

describe('ChatToolResult', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('fr');
    });

    it('marks a sub-agent step with a glyph every font has', () => {
        const { container } = render(<ChatToolResult name="researchTopic:searchSermons" />);

        expect(container.textContent).toBe('› Recherche de sermons');
        expect(container.textContent).not.toContain('↳');
    });

    it('says briefly when the research could not be finished', () => {
        const { container } = render(<ChatToolResult name="researchTopic" incomplete />);

        expect(container.textContent).toBe('Recherche approfondie · Recherche incomplète');
        expect(container.querySelector('.ant-tag-warning, .ant-tag-color-warning')).not.toBeNull();
    });

    it('is translated', async () => {
        await i18n.changeLanguage('en');
        const { container } = render(<ChatToolResult name="researchTopic" count={2} incomplete />);

        expect(container.textContent).toBe('In-depth research x2 · Research incomplete');
    });
});
