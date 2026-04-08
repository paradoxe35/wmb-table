import { Typography } from 'antd';
import type { CSSProperties } from 'react';
import InlineHelpPopover, { type InlineHelpContent } from './inline-help-popover';

const { Text } = Typography;

interface OptionPageHeaderProps {
    title: string;
    help: InlineHelpContent;
    extra?: React.ReactNode;
    style?: CSSProperties;
}

export default function OptionPageHeader({ title, help, extra, style }: OptionPageHeaderProps) {
    return (
        <div className="option-page-header" style={style}>
            <div className="option-page-header__title-row">
                <Text strong style={{ fontSize: 'var(--fs-base)' }}>
                    {title}
                </Text>
                <InlineHelpPopover content={help} />
            </div>
            {extra ? <div className="option-page-header__actions">{extra}</div> : null}
        </div>
    );
}
