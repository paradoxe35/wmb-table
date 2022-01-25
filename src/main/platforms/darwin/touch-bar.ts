import { mainMessageTransport, sendIpcToRenderer } from '@root/ipc/ipc-main';
import { getAssetPath } from '@root/sys';
import { ViewMenuValue } from '@localtypes/index';
import { IPC_EVENTS } from '@root/utils/ipc-events';

const { TouchBar, nativeImage } = require('electron');
const { TouchBarButton, TouchBarSpacer, TouchBarLabel } = TouchBar;

const BG_COLOR = '#1a9aef';
const menuView = (v: ViewMenuValue) => v;

const documentViewedTitle = new TouchBarLabel({});

// --------------  Option icon as touch bar button
const optionViewerMenu = new TouchBarButton({
  icon: nativeImage
    .createFromPath(getAssetPath('img/ProfileOutlined.png'))
    .resize({
      width: 16,
      height: 16,
    }),
  click() {
    sendIpcToRenderer(IPC_EVENTS.change_menu_viewer, menuView('options'));
  },
});

//  ----------- Option document viewer as touch bar button
const documentViewerMenu = new TouchBarButton({
  icon: nativeImage
    .createFromPath(getAssetPath('img/FundViewOutlined.png'))
    .resize({
      width: 16,
      height: 16,
    }),
  click() {
    sendIpcToRenderer(IPC_EVENTS.change_menu_viewer, menuView('document'));
  },
});

// listen for change active document or title document
const onActiveDocumentOnView = (_: any, document: string) => {
  documentViewedTitle.label = document;
};

// listen for viewer menu changed
const onChangeMenuViewer = (_: any, view: ViewMenuValue) => {
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
};

// init listeners when electron app is ready
mainMessageTransport(IPC_EVENTS.active_document_view, onActiveDocumentOnView);

mainMessageTransport(IPC_EVENTS.has_change_viewer_menu, onChangeMenuViewer);

// --------------  Touch bar button initialize for darwin only --------
export const touchBar = () =>
  new TouchBar({
    items: [
      optionViewerMenu,
      documentViewerMenu,
      new TouchBarSpacer({ size: 'large' }),
      documentViewedTitle,
    ],
  });
