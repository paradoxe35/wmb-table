import React from 'react';
import { useContainerScrollY } from '../utils/hooks';

const ContainerScrollY: React.FC<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > & { susDiff?: number }
> = ({ children, susDiff = 0, ...props }) => {
  const containerScroll = useContainerScrollY<HTMLDivElement>(
    [window],
    susDiff
  );

  return (
    <div {...props} className="container-y" ref={containerScroll}>
      {children}
    </div>
  );
};

export default ContainerScrollY;
