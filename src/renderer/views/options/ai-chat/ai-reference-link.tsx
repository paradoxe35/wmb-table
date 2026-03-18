import type React from 'react';
import { Tag } from 'antd';
import { parseWmbLink, useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';

const REF_COLORS = {
    sermon: 'blue',
    bible: 'green',
    doc: 'orange',
};

export default function AiReferenceLink(
    props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown },
) {
    const { href, children } = props;
    const navigate = useWmbLinkNavigate();

    if (!href) return <a>{children}</a>;

    const ref = parseWmbLink(href);
    if (!ref) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        );
    }

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(href);
    };

    return (
        <Tag
            data-href={href}
            color={REF_COLORS[ref.type]}
            onClick={handleClick}
            style={{ cursor: 'pointer', fontSize: '0.85em' }}
            bordered={false}
        >
            {children}
        </Tag>
    );
}
