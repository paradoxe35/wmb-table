// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiErrorCode, AiMessage } from '@shared/ai.types';
import type { AiRunNotice } from '@renderer/stores/ai-chat/chat-state';
import i18n from '@renderer/i18n';
import { useAppStore } from '@renderer/stores/app.store';
import { useAiChatStore } from '@renderer/stores/ai-chat.store';
import ChatRunNotice from '@renderer/views/options/ai-chat/chat-run-notice';
import {
    CONTINUE_ANSWER_PROMPT,
    CONTINUE_RESEARCH_PROMPT,
} from '@renderer/views/options/ai-chat/run-notice-copy';

const sendMessage = vi.fn(async () => true);
const retryLastUserMessage = vi.fn(async () => true);
const openSettingsTab = vi.fn();

function message(id: string, role: AiMessage['role'], content: string): AiMessage {
    return {
        id,
        conversationId: 'conv-1',
        role,
        content,
        toolCalls: [],
        toolResults: [],
        createdAt: '2026-11-26T10:00:00.000Z',
    };
}

function errorNotice(code: AiErrorCode | null, retryable: boolean | null = null): AiRunNotice {
    return {
        kind: 'error',
        messageId: 'a1',
        code,
        retryable,
        detail: 'Incorrect API key provided',
    };
}

function show(notice: AiRunNotice, answerHasText = false) {
    return render(
        <ChatRunNotice conversationId="conv-1" notice={notice} answerHasText={answerHasText} />,
    );
}

function buttonNames(): string[] {
    return screen.queryAllByRole('button').map((button) => button.textContent ?? '');
}

describe('ChatRunNotice', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('fr');
        sendMessage.mockClear();
        retryLastUserMessage.mockClear();
        openSettingsTab.mockClear();
        useAppStore.setState({ openSettingsTab });
        useAiChatStore.setState({
            sendMessage,
            retryLastUserMessage,
            messagesByConversation: { 'conv-1': [message('u1', 'user', 'Qui t’a dit ?')] },
        });
    });

    afterAll(async () => {
        await i18n.changeLanguage('fr');
    });

    it('offers to continue a cut answer in the same conversation', () => {
        show({ kind: 'truncated', messageId: 'a1' }, true);

        expect(screen.getByText(/^Réponse coupée/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

        expect(sendMessage).toHaveBeenCalledWith(CONTINUE_ANSWER_PROMPT);
    });

    it('offers to go on with research stopped by the step limit', () => {
        show({ kind: 'step-limit', messageId: 'a1' }, true);

        expect(screen.getByText(/^Recherche incomplète/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Poursuivre la recherche' }));

        expect(sendMessage).toHaveBeenCalledWith(CONTINUE_RESEARCH_PROMPT);
    });

    it('says the user stopped a partial answer and lets them continue it', () => {
        show({ kind: 'stopped', messageId: 'a1' }, true);

        expect(screen.getByRole('status').textContent).toContain('Arrêté par vous.');
        expect(buttonNames()).toEqual(['Continuer']);
    });

    it('reruns the question when the user stopped before any text', () => {
        show({ kind: 'stopped', messageId: 'a1' });

        fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

        expect(retryLastUserMessage).toHaveBeenCalledWith('conv-1', 'u1');
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('names a refused API key and opens the AI settings', () => {
        show(errorNotice('auth', false));

        expect(screen.getByRole('alert').textContent).toContain(
            'Clé API refusée. Vérifiez-la dans les paramètres.',
        );
        expect(screen.getByRole('alert').textContent).toContain('Incorrect API key provided');
        fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les paramètres IA' }));

        expect(openSettingsTab).toHaveBeenCalledWith('ai');
        expect(buttonNames()).toEqual(['Réessayer', 'Ouvrir les paramètres IA']);
    });

    it.each([
        ['model-not-found', 'Modèle introuvable', ['Réessayer', 'Ouvrir les paramètres IA']],
        ['rate-limit', 'Trop de demandes', ['Réessayer']],
        ['quota', 'Quota ou crédit épuisé', ['Ouvrir les paramètres IA']],
        ['provider-unavailable', 'Le service IA est indisponible', ['Réessayer']],
        ['network', 'Connexion perdue', ['Réessayer']],
        ['timeout', "n'a pas répondu à temps", ['Réessayer']],
        ['context-too-long', 'trop longue pour ce modèle', []],
        ['not-configured', 'pas encore configuré', ['Ouvrir les paramètres IA']],
        ['invalid-request', 'a refusé la demande', []],
        ['unknown', 'Une erreur est survenue.', ['Réessayer']],
    ] as const)('explains a %s error', (code, text, buttons) => {
        show(errorNotice(code));

        expect(screen.getByRole('alert').textContent).toContain(text);
        expect(buttonNames()).toEqual(buttons);
    });

    it('hides Retry when main says the error is not retryable', () => {
        show(errorNotice('network', false));

        expect(buttonNames()).toEqual([]);
    });

    it('shows the raw text with Retry when main sends no code', () => {
        show({
            kind: 'error',
            messageId: null,
            code: null,
            retryable: null,
            detail: 'Failed to process successful response',
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'Failed to process successful response' + 'Réessayer',
        );
    });

    it('translates a known app message sent without a code', async () => {
        await i18n.changeLanguage('en');
        show({
            kind: 'error',
            messageId: null,
            code: null,
            retryable: null,
            detail: 'La relance de la réponse a échoué.',
        });

        expect(screen.getByRole('alert').textContent).toContain('Retrying the response failed.');
    });

    it('resumes a dropped partial answer, since main only reruns unanswered questions', () => {
        useAiChatStore.setState({
            messagesByConversation: {
                'conv-1': [message('u1', 'user', 'Bonjour'), message('a1', 'assistant', 'Début')],
            },
        });
        show(errorNotice('network', true), true);

        fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

        expect(retryLastUserMessage).not.toHaveBeenCalled();
        expect(sendMessage).toHaveBeenCalledWith(CONTINUE_ANSWER_PROMPT);
    });

    it.each([
        ['en', 'API key refused. Check it in the settings.', 'Open AI settings', 'Retry'],
        [
            'es',
            'Clave API rechazada. Revísala en los ajustes.',
            'Abrir los ajustes de IA',
            'Reintentar',
        ],
        [
            'pt',
            'Chave de API recusada. Verifique-a nas configurações.',
            'Abrir as configurações de IA',
            'Tentar novamente',
        ],
        [
            'sw',
            'Ufunguo wa API umekataliwa. Uangalie katika mipangilio.',
            'Fungua mipangilio ya AI',
            'Jaribu tena',
        ],
    ])('is translated in %s', async (language, title, settingsLabel, retryLabel) => {
        await i18n.changeLanguage(language);
        show(errorNotice('auth'));

        expect(screen.getByRole('alert').textContent).toContain(title);
        expect(buttonNames()).toEqual([retryLabel, settingsLabel]);
    });

    it('sends the continue request in the UI language', async () => {
        await i18n.changeLanguage('en');
        show({ kind: 'truncated', messageId: 'a1' }, true);

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(sendMessage).toHaveBeenCalledWith('Continue your answer where it stopped.');
    });
});
