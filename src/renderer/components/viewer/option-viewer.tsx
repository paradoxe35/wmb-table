import React from 'react';
import { useOptionsMenu } from '@renderer/hooks';

const OptionViewer: React.FC<{ component: string }> = ({
  children,
  component,
}) => {
  const onClick = useOptionsMenu();

  return <a onClick={() => onClick(component)}>{children}</a>;
};

export default OptionViewer;
