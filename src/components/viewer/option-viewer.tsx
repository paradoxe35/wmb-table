import React, { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { appViewState, MAIN_VIEWS, optionViewState } from '../../store';

const OptionViewer: React.FC<{ component: string }> = ({
  children,
  component,
}) => {
  const setDocumentViewer = useSetRecoilState(appViewState);
  const setOptionViewer = useSetRecoilState(optionViewState);

  const onClick = useCallback(() => {
    setDocumentViewer(MAIN_VIEWS.options);
    setOptionViewer(component);
  }, []);

  return <a onClick={onClick}>{children}</a>;
};

export default OptionViewer;
