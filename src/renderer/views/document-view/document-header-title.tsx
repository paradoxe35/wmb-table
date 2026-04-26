import { Tooltip } from 'antd';

/**
 * Compact contextual title shown in the document header toolbar once the user has
 * scrolled past the in-content title. Truncates long titles with ellipsis and shows
 * the full text in a tooltip on hover.
 */
export function DocumentHeaderTitle({ title, visible }: { title: string; visible: boolean }) {
    if (!title) {
        return <div className="document-header-title" aria-hidden />;
    }

    return (
        <div className="document-header-title">
            <Tooltip title={visible ? title : ''} mouseEnterDelay={0.4} placement="bottom">
                <span
                    className={`document-header-title__text ${visible ? 'is-visible' : ''}`}
                    aria-hidden={!visible}
                >
                    {title}
                </span>
            </Tooltip>
        </div>
    );
}
