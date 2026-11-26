import type React from 'react';
import { Tag } from 'antd';
import { toSafeExternalUrl } from '@shared/external-url';
import { parseWmbLink, useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';

const REF_COLORS = {
    sermon: 'blue',
    bible: 'green',
    doc: 'orange',
};

function ExternalLink({ href, children }: { href?: string; children: React.ReactNode }) {
    const externalUrl = toSafeExternalUrl(href);
    if (!externalUrl) return <span>{children}</span>;

    return (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

export default function AiReferenceLink(
    props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown },
) {
    const { href, children } = props;
    const navigate = useWmbLinkNavigate();

    const ref = href ? parseWmbLink(href) : null;
    if (!href || !ref) return <ExternalLink href={href}>{children}</ExternalLink>;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(href);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        navigate(href);
    };

    return (
        <Tag
            className="ai-reference-tag"
            data-href={href}
            role="link"
            tabIndex={0}
            color={REF_COLORS[ref.type]}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            style={{ cursor: 'pointer', fontSize: 'var(--fs-rel-xl)' }}
            bordered={false}
        >
            {children}
        </Tag>
    );
}
