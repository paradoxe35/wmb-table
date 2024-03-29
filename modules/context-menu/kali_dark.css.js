const style = /* css */ `
.context {
  display: inline-block;
  position: fixed;
  top: 0px;
  left: 0px;
  z-index: 100;
  min-width: 200px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #fff;
  background: #262933;
  font-size: 9pt;
  border: 1px solid #333333;
  border-radius: 6px;
  box-shadow: 2px 2px 2px -1px rgba(0, 0, 0, 0.5);
  padding: 3px 0px;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.context .item {
  padding: 4px 19px;
  cursor: default;
  color: inherit;
}

.context .item:hover {
  background: #2777FF;
}

.context .item:hover .hotkey {
  color: #fff;
}

.context .disabled {
  color: #878B90;
}

.context .disabled:hover {
  background: inherit;
}

.context .disabled:hover .hotkey {
  color: #878B90;
}

.context .separator {
  margin: 4px 0px;
  height: 0;
  padding: 0;
  border-top: 1px solid #454545;
}

.hotkey {
  color: #878B90;
  float: right;
}
`;
/**
 * @param {string} content
 */
function injectStyleText(content) {
  const css = document.createElement('style');
  css.type = 'text/css';
  css.innerHTML = content;
  document.head.appendChild(css);
}

injectStyleText(style);
