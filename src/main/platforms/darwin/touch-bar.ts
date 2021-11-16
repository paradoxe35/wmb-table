import { mainMessageTransport } from '@root/ipc/ipc-main';
import { getAssetPath, mainWindow } from '@root/sys';
import { ViewMenuValue } from '@localtypes/index';
import { IPC_EVENTS } from '@root/utils/ipc-events';

const { TouchBar, nativeImage } = require('electron');
const { TouchBarButton, TouchBarSpacer, TouchBarLabel } = TouchBar;

const BG_COLOR = '#1a9aef';
const menuView = (v: ViewMenuValue) => v;

const documentViewedTitle = new TouchBarLabel({});

const optionViewerMenu = new TouchBarButton({
  icon: nativeImage
    .createFromPath(getAssetPath('img/ProfileOutlined.png'))
    .resize({
      width: 16,
      height: 16,
    }),
  click() {
    mainWindow?.webContents.send(
      IPC_EVENTS.change_menu_viewer,
      menuView('options')
    );
  },
});

const documentViewerMenu = new TouchBarButton({
  icon: nativeImage
    .createFromPath(getAssetPath('img/FundViewOutlined.png'))
    .resize({
      width: 16,
      height: 16,
    }),
  click() {
    mainWindow?.webContents.send(
      IPC_EVENTS.change_menu_viewer,
      menuView('document')
    );
  },
});

mainMessageTransport(
  IPC_EVENTS.active_document_view,
  (_: any, document: string) => {
    documentViewedTitle.label = document;
  }
);

mainMessageTransport(
  IPC_EVENTS.has_change_viewer_menu,
  (_: any, view: ViewMenuValue) => {
    if (view === 'document') {
      documentViewerMenu.backgroundColor = BG_COLOR;
      //@ts-ignore
      optionViewerMenu.backgroundColor = null;
    }
    if (view === 'options') {
      //@ts-ignore
      documentViewerMenu.backgroundColor = null;
      optionViewerMenu.backgroundColor = BG_COLOR;
    }
  }
);

export const touchBar = new TouchBar({
  items: [
    optionViewerMenu,
    documentViewerMenu,
    new TouchBarSpacer({ size: 'large' }),
    documentViewedTitle,
  ],
});
