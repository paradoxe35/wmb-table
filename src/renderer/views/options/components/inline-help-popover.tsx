import { Button, Popover, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { PopoverProps } from 'antd';

const { Text } = Typography;

export interface InlineHelpSection {
    title?: string;
    description?: string;
    items?: string[];
}

export interface InlineHelpContent {
    title: string;
    summary: string;
    sections?: InlineHelpSection[];
    footer?: string;
}

interface InlineHelpPopoverProps {
    content: InlineHelpContent;
    placement?: PopoverProps['placement'];
    triggerLabel?: string;
}

function HelpBody({ content }: { content: InlineHelpContent }) {
    return (
        <div className="inline-help-card">
            <Text strong style={{ display: 'block', fontSize: 'var(--fs-rel-4xl)' }}>
                {content.title}
            </Text>
            <Text
                type="secondary"
                className="inline-help-card__summary"
                style={{ fontSize: 'var(--fs-rel-xl)' }}
            >
                {content.summary}
            </Text>

            {content.sections?.map((section) => (
                <div
                    key={`${section.title ?? section.description ?? 'section'}-${section.items?.join('|') ?? ''}`}
                    className="inline-help-card__section"
                >
                    {section.title ? (
                        <Text strong style={{ display: 'block', fontSize: 'var(--fs-rel-2xl)' }}>
                            {section.title}
                        </Text>
                    ) : null}
                    {section.description ? (
                        <Text
                            type="secondary"
                            style={{ display: 'block', fontSize: 'var(--fs-rel-xl)' }}
                        >
                            {section.description}
                        </Text>
                    ) : null}
                    {section.items?.length ? (
                        <ul className="inline-help-card__list">
                            {section.items.map((item) => (
                                <li key={item}>
                                    <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                                        {item}
                                    </Text>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ))}

            {content.footer ? (
                <Text className="inline-help-card__footer" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                    {content.footer}
                </Text>
            ) : null}
        </div>
    );
}

export default function InlineHelpPopover({
    content,
    placement = 'bottomRight',
    triggerLabel,
}: InlineHelpPopoverProps) {
    const { t } = useTranslation();

    return (
        <Popover
            trigger="click"
            placement={placement}
            content={<HelpBody content={content} />}
            overlayClassName="inline-help-popover"
        >
            <Button
                type="text"
                size="small"
                shape="circle"
                className="inline-help-trigger"
                icon={<QuestionCircleOutlined />}
                aria-label={triggerLabel ?? t('Comprendre cette page')}
            />
        </Popover>
    );
}
