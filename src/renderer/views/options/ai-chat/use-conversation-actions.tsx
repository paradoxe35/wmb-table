import { useCallback } from 'react';
import { App as AntApp, message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AiConversation } from '@shared/ai.types';
import type { PdfExportResult } from '@shared/ipc.types';
import { useAiChatStore } from '@renderer/stores/ai-chat.store';
import { AutoFocusInput } from '@renderer/components/auto-focus-input';

export interface ConversationActionCallbacks {
    onRenameConversation: (conversationId: string, title: string) => Promise<AiConversation>;
    onExportConversation: (conversationId: string) => Promise<PdfExportResult>;
    onDeleteConversation: (conversationId: string) => void;
}

export interface ConversationActions {
    openRenameModal: () => void;
    confirmDelete: () => void;
    handleExport: () => Promise<void>;
}

export function useConversationActions(
    conversation: AiConversation,
    callbacks: ConversationActionCallbacks,
): ConversationActions {
    const { t } = useTranslation();
    const { modal } = AntApp.useApp();
    const { onRenameConversation, onExportConversation, onDeleteConversation } = callbacks;
    const isKnownEmpty = useAiChatStore((s) => {
        const messages = s.messagesByConversation[conversation.id];
        return messages != null && messages.length === 0;
    });

    const openRenameModal = useCallback(() => {
        let nextTitle = conversation.title ?? '';

        const save = async () => {
            const trimmedTitle = nextTitle.trim();
            if (!trimmedTitle) {
                message.error(t('Le nom entré est invalid'));
                throw new Error('invalid-title');
            }

            try {
                await onRenameConversation(conversation.id, trimmedTitle);
                message.success(t('Conversation renommée'));
            } catch (error) {
                const errorMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : 'Conversation introuvable.';
                message.error(t(errorMessage));
                throw error;
            }
        };

        const modalInstance = modal.info({
            closable: true,
            icon: null,
            title: t('Renommer'),
            okText: t('Enregistrer'),
            content: (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save()
                            .then(() => modalInstance.destroy())
                            .catch(() => {});
                    }}
                >
                    <AutoFocusInput
                        size="large"
                        defaultValue={conversation.title ?? ''}
                        allowClear
                        onChange={(event) => {
                            nextTitle = event.currentTarget.value;
                        }}
                        placeholder={t('Nom de la conversation')}
                    />
                </form>
            ),
            onOk: save,
        });
    }, [conversation.id, conversation.title, modal, onRenameConversation, t]);

    const confirmDelete = useCallback(() => {
        if (isKnownEmpty) {
            onDeleteConversation(conversation.id);
            return;
        }
        modal.confirm({
            title: t('Supprimer cette conversation ?'),
            okText: t('Supprimer'),
            cancelText: t('Annuler'),
            okButtonProps: { danger: true },
            onOk: () => onDeleteConversation(conversation.id),
        });
    }, [conversation.id, isKnownEmpty, modal, onDeleteConversation, t]);

    const handleExport = useCallback(async () => {
        try {
            const result = await onExportConversation(conversation.id);
            if (result.status === 'success') {
                message.success(t('PDF exporté avec succès'));
            } else if (result.status === 'empty') {
                message.warning(t('Cette conversation est vide.'));
            }
        } catch {
            message.error(t("Erreur lors de l'export PDF"));
        }
    }, [conversation.id, onExportConversation, t]);

    return { openRenameModal, confirmDelete, handleExport };
}
