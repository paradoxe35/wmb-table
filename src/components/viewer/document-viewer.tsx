import React from 'react';

const DocumentViewer: React.FC<{ name: string; id: string }> = ({
  children,
}) => {
  return <span>{children}</span>;
};

export default DocumentViewer;
