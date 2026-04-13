import { memo, useMemo } from 'react';
import TimeAgo, { type Formatter, type Props as TimeAgoProps } from 'react-timeago';
import { useTranslation } from 'react-i18next';
import { formatAbsoluteDateTime, formatRelativeTimeLabel } from '@renderer/lib/relative-time';

type RelativeTimeProps = Omit<TimeAgoProps, 'formatter'>;

export default memo(function RelativeTime({ date, title, ...props }: RelativeTimeProps) {
    const { t, i18n } = useTranslation();

    const formatter = useMemo<Formatter>(
        () => (value, unit) => formatRelativeTimeLabel(t, value, unit),
        [t],
    );

    const resolvedTitle = useMemo(
        () => title ?? formatAbsoluteDateTime(date, i18n.resolvedLanguage ?? i18n.language),
        [date, i18n.language, i18n.resolvedLanguage, title],
    );

    return <TimeAgo date={date} formatter={formatter} title={resolvedTitle} {...props} />;
});
