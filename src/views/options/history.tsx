import React, { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { currentDocumentTabs } from '../../store';
import { debounce } from '../../utils/functions';

export default function History() {
  const title = useRecoilValue(currentDocumentTabs);

  const titleHandler = () => {};

  useEffect(() => {
    debounce(titleHandler, 1500);
  }, [title]);

  return <div>History</div>;
}
