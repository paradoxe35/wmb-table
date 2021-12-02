import React from 'react';
import { render } from 'react-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import AppLayout from './renderer/components/layout';
import { RecoilRoot } from 'recoil';
import { ContentApp } from '@renderer/app';

// import css
import './app.global.scss';
import '@modules/context-menu/kali_dark.css';

render(
  <RecoilRoot>
    <ConfigProvider locale={frFR}>
      <AppLayout>
        <ContentApp />
      </AppLayout>
    </ConfigProvider>
  </RecoilRoot>,
  document.getElementById('root')
);
