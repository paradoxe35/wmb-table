import React, { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { currentDocumentTabs } from '../../store';
import { capitalizeFirstLetter, debounce } from '../../utils/functions';

function getDateTime() {
  const date = new Date();
  const int = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: undefined,
  });
  return {
    date: capitalizeFirstLetter(int.format(date)),
    time: date.toTimeString().split(' ')[0],
  };
}

export default function History() {
  const title = useRecoilValue(currentDocumentTabs);

  const titleHandler = () => {};

  useEffect(() => {
    debounce(titleHandler, 1500);
  }, [title]);

  return <div>History</div>;
}
