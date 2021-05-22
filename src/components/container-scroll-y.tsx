import React from 'react';
import { useContainerScrollY } from '../utils/hooks';

const ContainerScrollY: React.FC<React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>> = ({ children, ...props }) => {
  const containerScroll = useContainerScrollY<HTMLDivElement>();

  return (
    <div {...props} className="container-y" ref={containerScroll}>
      {children}
    </div>
  );
};

export default ContainerScrollY;
