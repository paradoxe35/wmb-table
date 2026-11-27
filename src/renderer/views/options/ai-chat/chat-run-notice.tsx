import { Alert, Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AiRunNotice } from '@renderer/stores/ai-chat/chat-state';
import { describeRunNotice, RUN_NOTICE_ACTION_LABELS } from './run-notice-copy';
import { useRunNoticeActions } from './use-run-notice-actions';

/** Raw provider text is shown as is, unless it is one of the app's own translated messages. */
const RAW_TEXT_OPTIONS = { keySeparator: false, nsSeparator: false } as const;

export default function ChatRunNotice({
    conversationId,
    notice,
    answerHasText,
}: {
    conversationId: string;
    notice: AiRunNotice;
    answerHasText: boolean;
}) {
    const { t } = useTranslation();
    const runAction = useRunNoticeActions(conversationId);
    const copy = describeRunNotice(notice, answerHasText);
    const title = t(copy.title, RAW_TEXT_OPTIONS);
    const detail = copy.detail ? t(copy.detail, RAW_TEXT_OPTIONS) : null;

    return (
        <Alert
            className="ai-chat__run-notice"
            type={copy.tone}
            showIcon
            role={copy.tone === 'error' ? 'alert' : 'status'}
            title={title}
            description={
                detail && detail !== title ? (
                    <Typography.Text
                        type="secondary"
                        className="ai-chat__run-notice-detail"
                        ellipsis={{ tooltip: detail }}
                    >
                        {detail}
                    </Typography.Text>
                ) : undefined
            }
            action={
                copy.actions.length > 0 ? (
                    <div className="ai-chat__run-notice-actions">
                        {copy.actions.map((action) => (
                            <Button
                                key={action}
                                size="small"
                                type={action === copy.actions[0] ? 'primary' : 'default'}
                                className={action === 'retry' ? 'ai-chat__retry-button' : undefined}
                                onClick={() => runAction(action)}
                            >
                                {t(RUN_NOTICE_ACTION_LABELS[action])}
                            </Button>
                        ))}
                    </div>
                ) : undefined
            }
        />
    );
}
