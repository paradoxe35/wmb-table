import Icon from '@ant-design/icons';
import type { CSSProperties } from 'react';

const Sun = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
        <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-4a1 1 0 011 1v1a1 1 0 01-2 0V4a1 1 0 011-1zm0 16a1 1 0 011 1v1a1 1 0 01-2 0v-1a1 1 0 011-1zm9-8a1 1 0 01-1 1h-1a1 1 0 010-2h1a1 1 0 011 1zM5 12a1 1 0 01-1 1H3a1 1 0 010-2h1a1 1 0 011 1zm13.07-5.07a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 0zM7.05 16.95a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 0zm11.9 0l.71.71a1 1 0 01-1.41 1.41l-.71-.71a1 1 0 011.41-1.41zM7.05 7.05l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 1.41z" />
    </svg>
);

const Moon = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
        <path d="M12.1 22c-5.5 0-10-4.5-10-10 0-4.8 3.4-8.8 8.1-9.8.4-.1.8 0 1.1.3.3.3.3.7.2 1.1-.5 1.2-.7 2.5-.7 3.9 0 5 4 9 9 9 .7 0 1.4-.1 2.1-.2.4-.1.8 0 1.1.3.3.3.3.7.2 1.1-1.1 2.6-3.7 4.3-11.1 4.3z" />
    </svg>
);

export function SunIcon({ style }: { style?: CSSProperties }) {
    return <Icon component={Sun} style={style} />;
}

export function MoonIcon({ style }: { style?: CSSProperties }) {
    return <Icon component={Moon} style={style} />;
}

const Bible = () => {
    const style = {
        enableBackground: 'new 0 0 512 512',
    };
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            version="1.1"
            id="Layer_1"
            x="0px"
            y="0px"
            fill="currentColor"
            viewBox="0 0 512 512"
            style={style as any}
            xmlSpace="preserve"
            width="1em"
            height="1em"
        >
            <path d="M100.5,432h311c33.084,0,60-26.916,60-60V60c0-33.084-26.916-60-60-60h-311c-33.084,0-60,26.916-60,60v392  c0,33.084,26.916,60,60,60h291h20c33.084,0,60-26.916,60-60v-0.05c-16.725,12.583-37.506,20.05-60,20.05h-20h-291  c-11.028,0-20-8.972-20-20S89.472,432,100.5,432z M80.5,60c0-11.028,8.972-20,20-20h311c11.028,0,20,8.972,20,20v312  c0,11.028-8.972,20-20,20h-311c-7.009,0-13.742,1.208-20,3.427V60z M235.5,206h-66v-40h66v-65h40v65h66v40h-66v126h-40V206z" />
        </svg>
    );
};

export function BibleIcons() {
    return <Icon component={Bible} />;
}
