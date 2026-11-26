import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAiRunOutcomeStore } from '@renderer/stores/ai-chat-run-events';

export default function ChatRunNotice({ messageId }: { messageId: string }) {
    const { t } = useTranslation();
    const truncated = useAiRunOutcomeStore((s) => s.byMessageId[messageId]?.truncated === true);

    if (!truncated) {
        return null;
    }

    return (
        <Alert
            className="ai-chat__run-notice"
            type="warning"
            showIcon
            title={t(
                'Réponse coupée : elle a atteint la longueur maximale que ce modèle peut écrire.',
            )}
        />
    );
}
