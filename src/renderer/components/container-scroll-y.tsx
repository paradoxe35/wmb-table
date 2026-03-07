import React from 'react';
import { useContainerHeight } from '@renderer/hooks';

const ContainerScrollY: React.FC<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
        susDiff?: number;
        canRef?: boolean;
        className?: string;
        children?: React.ReactNode;
    }
> = ({ children, susDiff = 0, className = '', canRef = true, ...props }) => {
    const containerScroll = useContainerHeight<HTMLDivElement>(susDiff);

    return (
        <div
            {...props}
            className={`container-y ${className}`}
            ref={canRef ? containerScroll : undefined}
        >
            {children}
        </div>
    );
};

export default ContainerScrollY;
