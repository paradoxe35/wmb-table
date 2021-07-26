import React from 'react';
import { useContainerScrollY } from '../utils/hooks';

const ContainerScrollY: React.FC<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > & { susDiff?: number; canRef?: boolean; className: string }
> = ({ children, susDiff = 0, className = '', canRef = true, ...props }) => {
  const containerScroll = useContainerScrollY<HTMLDivElement>(
    [window],
    susDiff
  );

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
