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
