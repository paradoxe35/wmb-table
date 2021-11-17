import { pageContainer } from './functions.js';

export const searchTemplateHtml = /* html */ `
<div class="search--template active">
  <div class="find-actions">
      <div title="Recherche" tabindex="-1" class="button search--open--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="file-search" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M688 312v-48c0-4.4-3.6-8-8-8H296c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h384c4.4 0 8-3.6 8-8zm-392 88c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h184c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H296zm144 452H208V148h560v344c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V108c0-17.7-14.3-32-32-32H168c-17.7 0-32 14.3-32 32v784c0 17.7 14.3 32 32 32h272c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm445.7 51.5l-93.3-93.3C814.7 780.7 828 743.9 828 704c0-97.2-78.8-176-176-176s-176 78.8-176 176 78.8 176 176 176c35.8 0 69-10.7 96.8-29l94.7 94.7c1.6 1.6 3.6 2.3 5.6 2.3s4.1-.8 5.6-2.3l31-31a7.9 7.9 0 000-11.2zM652 816c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z">
              </path>
          </svg>
      </div>
      <div title="Match précédent" tabindex="-1" class="button search--prev--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="arrow-up" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M868 545.5L536.1 163a31.96 31.96 0 00-48.3 0L156 545.5a7.97 7.97 0 006 13.2h81c4.6 0 9-2 12.1-5.5L474 300.9V864c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V300.9l218.9 252.3c3 3.5 7.4 5.5 12.1 5.5h81c6.8 0 10.5-8 6-13.2z">
              </path>
          </svg>
      </div>
      <div title="Prochain match" tabindex="-1" class="button search--next--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="arrow-down" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M862 465.3h-81c-4.6 0-9 2-12.1 5.5L550 723.1V160c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v563.1L255.1 470.8c-3-3.5-7.4-5.5-12.1-5.5h-81c-6.8 0-10.5 8.1-6 13.2L487.9 861a31.96 31.96 0 0048.3 0L868 478.5c4.5-5.2.8-13.2-6-13.2z">
              </path>
          </svg>
      </div>

      <div title="Fermer" tabindex="0" class="button search--close--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="close" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z">
              </path>
          </svg>
      </div>

      <div tabindex="0" style="margin: 0 5px">|</div>

      <div tabindex="0" class="button search--result--js">0/0</div>

      <div tabindex="0" style="margin: 0 5px">|</div>

      <div title="zoom" tabindex="0" class="button search--zoom--js" role="button">
        <span class="zoom-data"></span>
        <div style="margin: 0 2px"></div>
        <span class="icon-data"></span>
      </div>

      <div tabindex="0" style="margin: 0 5px"></div>
  </div>
</div>
`;

export const zoomInTemplate = /* html */ `
<svg viewBox="64 64 896 896" focusable="false" data-icon="zoom-in" width="0.9em" height="0.9em" fill="currentColor" aria-hidden="true">
  <path d="M637 443H519V309c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v134H325c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h118v134c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V519h118c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8zm284 424L775 721c122.1-148.9 113.6-369.5-26-509-148-148.1-388.4-148.1-537 0-148.1 148.6-148.1 389 0 537 139.5 139.6 360.1 148.1 509 26l146 146c3.2 2.8 8.3 2.8 11 0l43-43c2.8-2.7 2.8-7.8 0-11zM696 696c-118.8 118.7-311.2 118.7-430 0-118.7-118.8-118.7-311.2 0-430 118.8-118.7 311.2-118.7 430 0 118.7 118.8 118.7 311.2 0 430z"></path>
</svg>
`;

export const zoomOutTemplate = /* html */ `
<svg viewBox="64 64 896 896" focusable="false" data-icon="zoom-out" width="0.9em" height="0.9em" fill="currentColor" aria-hidden="true">
  <path d="M637 443H325c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h312c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8zm284 424L775 721c122.1-148.9 113.6-369.5-26-509-148-148.1-388.4-148.1-537 0-148.1 148.6-148.1 389 0 537 139.5 139.6 360.1 148.1 509 26l146 146c3.2 2.8 8.3 2.8 11 0l43-43c2.8-2.7 2.8-7.8 0-11zM696 696c-118.8 118.7-311.2 118.7-430 0-118.7-118.8-118.7-311.2 0-430 118.8-118.7 311.2-118.7 430 0 118.7 118.8 118.7 311.2 0 430z"></path>
</svg>
`;

export const searchTemplateCss = /* css */ `
.search--template {
  height: 33px;
  position: absolute;
  max-width: 759px;
  right: 30px;
  top: 5px;
  color: #000;
  opacity: 1;
  box-shadow: 0 7px 14px rgba(50, 50, 93, .1), 0 3px 6px rgba(0, 0, 0, 0.041);
  background-color: #e4e3e3;
  transform: translateY(calc(-100% - 10px));
  overflow: hidden;
  border-radius: 2px;
  line-height: 19px;
  transition: transform .2s linear;
  padding: 4px 4px;
  box-sizing: border-box;
  z-index: 35;
}

.search--template.active {
  transform: translateY(0);
}

.search--template .find-actions {
  height: 25px;
  display: flex;
  align-items: center;
}

.search--template .disabled {
  opacity: .3;
  cursor: default;
}

.search--template .button {
  min-width: 23px;
  height: 23px;
  flex: initial;
  margin-left: 5px;
  background-position: 50%;
  background-repeat: no-repeat;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;

/**
 * @param {string} content
 */
export function injectStyleText(content) {
  const css = document.createElement('style');
  css.type = 'text/css';
  css.innerHTML = content;
  document.head.appendChild(css);
}

// controller bar
// first resize container height
const container = pageContainer();
container.style.height = 'calc(100% - 50px)';

const controllerBarHtml = /* html */ `
  <div class="controller--bar">
    <div class="box"></div>
  </div>
`;

document.body.appendChild(
  document.createRange().createContextualFragment(controllerBarHtml)
);

const controllerBarCss = /* css */ `
  .controller--bar {
    height: 40px;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 5px;
    overflow: hidden;
    z-index: 35;
    display: flex;
    justify-content: center;
  }

  .controller--bar .box {
    color: #000;
    overflow: hidden;
    width: 90%;
    max-width: 759px;
    height: 100%;
    box-shadow: 0 7px 14px rgba(50, 50, 93, .01), 0 3px 6px rgba(0, 0, 0, 0.041);
    background-color: #e4e3e3;
    border-radius: 2px;
    line-height: 19px;
    transition: all .2s linear;
    padding-top: 5px;
    padding-bottom: 5px;
    box-sizing: border-box;
  }
`;

injectStyleText(controllerBarCss);
