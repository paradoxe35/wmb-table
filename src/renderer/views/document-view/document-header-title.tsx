/**
 * Compact contextual title shown in the document header toolbar once the user has
 * scrolled past the in-content title. Truncates long titles with ellipsis and shows
 * the full text via the native browser tooltip on hover.
 */
export function DocumentHeaderTitle({ title, visible }: { title: string; visible: boolean }) {
    if (!title) {
        return <div className="document-header-title" aria-hidden />;
    }

    return (
        <div className="document-header-title">
            <span
                className={`document-header-title__text ${visible ? 'is-visible' : ''}`}
                title={visible ? title : undefined}
                aria-hidden={!visible}
            >
                {title}
            </span>
        </div>
    );
}
