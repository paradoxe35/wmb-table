import type { SermonMeta } from '@shared/types';
import { useFormatSermonDate } from '@renderer/hooks';

export default function SermonContentHeader({ meta }: { meta: SermonMeta }) {
    const formatDate = useFormatSermonDate();

    return (
        <div className="sermon-content-header">
            <h2 className="sermon-content-header__title">{meta.title}</h2>
            {meta.dateMs !== 0 && (
                <div className="sermon-content-header__date">
                    Date: {formatDate(meta.dateMs)}
                    {meta.location ? ` ${meta.location}` : ''}
                </div>
            )}
            {meta.traductionName && (
                <div className="sermon-content-header__traduction">
                    Traduction: {meta.traductionName}
                </div>
            )}
        </div>
    );
}
