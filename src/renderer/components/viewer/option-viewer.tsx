import React from 'react';
import { useAppStore } from '@renderer/stores';

const OptionViewer: React.FC<{ component: string; children?: React.ReactNode }> = ({
    children,
    component,
}) => {
    const showOptions = useAppStore((s) => s.showOptions);

    return <a onClick={() => showOptions(component as 'search')}>{children}</a>;
};

export default OptionViewer;
