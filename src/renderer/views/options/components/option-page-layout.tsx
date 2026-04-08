import type { CSSProperties, ReactNode } from 'react';
import type { InlineHelpContent } from './inline-help-popover';
import OptionPageHeader from './option-page-header';

interface OptionPageLayoutProps {
    title: string;
    help: InlineHelpContent;
    children: ReactNode;
    extra?: ReactNode;
    headerStyle?: CSSProperties;
    bodyStyle?: CSSProperties;
    gap?: CSSProperties['gap'];
}

export default function OptionPageLayout({
    title,
    help,
    children,
    extra,
    headerStyle,
    bodyStyle,
    gap = 'var(--option-page-gap)',
}: OptionPageLayoutProps) {
    return (
        <div className="option-page-layout" style={{ gap }}>
            <OptionPageHeader title={title} help={help} extra={extra} style={headerStyle} />
            <div className="option-page-layout__body" style={bodyStyle}>
                {children}
            </div>
        </div>
    );
}
