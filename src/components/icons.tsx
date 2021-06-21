import Icon from '@ant-design/icons';
import React from 'react';

const Bible = () => {
  const style = {
    enableBackground: 'new 0 0 512 512',
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      version="1.1"
      id="Layer_1"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={style as any}
      xmlSpace="preserve"
      width="1em"
      height="1em"
    >
      <path d="M100.5,432h311c33.084,0,60-26.916,60-60V60c0-33.084-26.916-60-60-60h-311c-33.084,0-60,26.916-60,60v392  c0,33.084,26.916,60,60,60h291h20c33.084,0,60-26.916,60-60v-0.05c-16.725,12.583-37.506,20.05-60,20.05h-20h-291  c-11.028,0-20-8.972-20-20S89.472,432,100.5,432z M80.5,60c0-11.028,8.972-20,20-20h311c11.028,0,20,8.972,20,20v312  c0,11.028-8.972,20-20,20h-311c-7.009,0-13.742,1.208-20,3.427V60z M235.5,206h-66v-40h66v-65h40v65h66v40h-66v126h-40V206z" />
    </svg>
  );
};

export function BibleIcons() {
  return <Icon component={Bible} />;
}
