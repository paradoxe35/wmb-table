import Icon from '@ant-design/icons';
import type { CSSProperties } from 'react';

const BlockquoteSvg = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
        <path d="M7.5 6C4.9 6 3 8.1 3 10.9V18a1 1 0 001 1h5.5a1 1 0 001-1v-5.5a1 1 0 00-1-1H6.1v-.6C6.1 9.8 6.8 9 7.8 9h1.7a1 1 0 100-2h-2zm10 0C14.9 6 13 8.1 13 10.9V18a1 1 0 001 1h5.5a1 1 0 001-1v-5.5a1 1 0 00-1-1h-3.4v-.6c0-1.1.7-1.9 1.7-1.9h1.7a1 1 0 100-2h-2z" />
    </svg>
);

export function BlockquoteIcon({ style }: { style?: CSSProperties }) {
    return <Icon component={BlockquoteSvg} style={style} />;
}
