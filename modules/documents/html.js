import { pageContainer } from './functions.js';
import { WINDOW_ZOOM } from './seach-query.js';

/**
 * @param {string} content
 */
export function injectStyleText(content) {
  const css = document.createElement('style');
  css.type = 'text/css';
  css.innerHTML = content;
  document.head.appendChild(css);
}

export const playIcon = /* html */ `
<svg viewBox="64 64 896 896" focusable="false" data-icon="play-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true">
  <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path>
  <path d="M719.4 499.1l-296.1-215A15.9 15.9 0 00398 297v430c0 13.1 14.8 20.5 25.3 12.9l296.1-215a15.9 15.9 0 000-25.8zm-257.6 134V390.9L628.5 512 461.8 633.1z"></path>
</svg>
`;

export const pauseIcon = /* html */ `
<svg viewBox="64 64 896 896" focusable="false" data-icon="pause-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true">
  <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372zm-88-532h-48c-4.4 0-8 3.6-8 8v304c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V360c0-4.4-3.6-8-8-8zm224 0h-48c-4.4 0-8 3.6-8 8v304c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V360c0-4.4-3.6-8-8-8z"></path>
</svg>
`;

const controllerBarHtml = /* html */ `
  <div class="controller--bar clearfix">
    <div class="box clearfix">

      <div tooltip="Recherche" tabindex="0" class="button search--open--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="file-search" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M688 312v-48c0-4.4-3.6-8-8-8H296c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h384c4.4 0 8-3.6 8-8zm-392 88c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h184c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H296zm144 452H208V148h560v344c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V108c0-17.7-14.3-32-32-32H168c-17.7 0-32 14.3-32 32v784c0 17.7 14.3 32 32 32h272c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm445.7 51.5l-93.3-93.3C814.7 780.7 828 743.9 828 704c0-97.2-78.8-176-176-176s-176 78.8-176 176 78.8 176 176 176c35.8 0 69-10.7 96.8-29l94.7 94.7c1.6 1.6 3.6 2.3 5.6 2.3s4.1-.8 5.6-2.3l31-31a7.9 7.9 0 000-11.2zM652 816c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z">
              </path>
          </svg>
      </div>
      <div tooltip="Paragraphe" tabindex="0" class="button search--paragraph--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="sort-ascending" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M839.6 433.8L749 150.5a9.24 9.24 0 00-8.9-6.5h-77.4c-4.1 0-7.6 2.6-8.9 6.5l-91.3 283.3c-.3.9-.5 1.9-.5 2.9 0 5.1 4.2 9.3 9.3 9.3h56.4c4.2 0 7.8-2.8 9-6.8l17.5-61.6h89l17.3 61.5c1.1 4 4.8 6.8 9 6.8h61.2c1 0 1.9-.1 2.8-.4 2.4-.8 4.3-2.4 5.5-4.6 1.1-2.2 1.3-4.7.6-7.1zM663.3 325.5l32.8-116.9h6.3l32.1 116.9h-71.2zm143.5 492.9H677.2v-.4l132.6-188.9c1.1-1.6 1.7-3.4 1.7-5.4v-36.4c0-5.1-4.2-9.3-9.3-9.3h-204c-5.1 0-9.3 4.2-9.3 9.3v43c0 5.1 4.2 9.3 9.3 9.3h122.6v.4L587.7 828.9a9.35 9.35 0 00-1.7 5.4v36.4c0 5.1 4.2 9.3 9.3 9.3h211.4c5.1 0 9.3-4.2 9.3-9.3v-43a9.2 9.2 0 00-9.2-9.3zM416 702h-76V172c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v530h-76c-6.7 0-10.5 7.8-6.3 13l112 141.9a8 8 0 0012.6 0l112-141.9c4.1-5.2.4-13-6.3-13z"></path>
        </svg>
      </div>

      <div tabindex="-1" class="separator"></div>

      <div tooltip="Occurrence précédente" tabindex="0" class="button search--field display-none search--prev--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="arrow-up" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M868 545.5L536.1 163a31.96 31.96 0 00-48.3 0L156 545.5a7.97 7.97 0 006 13.2h81c4.6 0 9-2 12.1-5.5L474 300.9V864c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V300.9l218.9 252.3c3 3.5 7.4 5.5 12.1 5.5h81c6.8 0 10.5-8 6-13.2z">
              </path>
          </svg>
      </div>
      <div tooltip="Prochaine occurrence" tabindex="0" class="button search--field display-none search--next--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="arrow-down" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M862 465.3h-81c-4.6 0-9 2-12.1 5.5L550 723.1V160c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v563.1L255.1 470.8c-3-3.5-7.4-5.5-12.1-5.5h-81c-6.8 0-10.5 8.1-6 13.2L487.9 861a31.96 31.96 0 0048.3 0L868 478.5c4.5-5.2.8-13.2-6-13.2z">
              </path>
          </svg>
      </div>
      <div tabindex="-1" class="button search--field display-none search--result--js">0/0</div>
      <div tooltip="Fermer la recherche" tabindex="0" class="button search--field display-none search--close--js" role="button">
          <svg viewBox="64 64 896 896" focusable="false" data-icon="close" width="1em" height="1em"
              fill="currentColor" aria-hidden="true">
              <path
                  d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z">
              </path>
          </svg>
      </div>

      <div tabindex="-1" class="separator display-none search--field"></div>

      <div tooltip="Dézoomer" tabindex="0" class="button search--zoom-out--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="zoom-out" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M637 443H325c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h312c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8zm284 424L775 721c122.1-148.9 113.6-369.5-26-509-148-148.1-388.4-148.1-537 0-148.1 148.6-148.1 389 0 537 139.5 139.6 360.1 148.1 509 26l146 146c3.2 2.8 8.3 2.8 11 0l43-43c2.8-2.7 2.8-7.8 0-11zM696 696c-118.8 118.7-311.2 118.7-430 0-118.7-118.8-118.7-311.2 0-430 118.8-118.7 311.2-118.7 430 0 118.7 118.8 118.7 311.2 0 430z"></path>
        </svg>
      </div>
      <div tooltip="Zoomer" tabindex="0" class="button search--zoom-in--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="zoom-in" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M637 443H519V309c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v134H325c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h118v134c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V519h118c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8zm284 424L775 721c122.1-148.9 113.6-369.5-26-509-148-148.1-388.4-148.1-537 0-148.1 148.6-148.1 389 0 537 139.5 139.6 360.1 148.1 509 26l146 146c3.2 2.8 8.3 2.8 11 0l43-43c2.8-2.7 2.8-7.8 0-11zM696 696c-118.8 118.7-311.2 118.7-430 0-118.7-118.8-118.7-311.2 0-430 118.8-118.7 311.2-118.7 430 0 118.7 118.8 118.7 311.2 0 430z"></path>
        </svg>
      </div>
      <div tabindex="-1" class="button">
        <span class="search--zoom-data--js">${WINDOW_ZOOM.value}</span>%
      </div>

      <div tabindex="-1" class="separator display-none document-external-field-separator"></div>

      <div tooltip="Ouvrir le lien sur internet" tabindex="0" class="button display-none search--web-link--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="link" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M574 665.4a8.03 8.03 0 00-11.3 0L446.5 781.6c-53.8 53.8-144.6 59.5-204 0-59.5-59.5-53.8-150.2 0-204l116.2-116.2c3.1-3.1 3.1-8.2 0-11.3l-39.8-39.8a8.03 8.03 0 00-11.3 0L191.4 526.5c-84.6 84.6-84.6 221.5 0 306s221.5 84.6 306 0l116.2-116.2c3.1-3.1 3.1-8.2 0-11.3L574 665.4zm258.6-474c-84.6-84.6-221.5-84.6-306 0L410.3 307.6a8.03 8.03 0 000 11.3l39.7 39.7c3.1 3.1 8.2 3.1 11.3 0l116.2-116.2c53.8-53.8 144.6-59.5 204 0 59.5 59.5 53.8 150.2 0 204L665.3 562.6a8.03 8.03 0 000 11.3l39.8 39.8c3.1 3.1 8.2 3.1 11.3 0l116.2-116.2c84.5-84.6 84.5-221.5 0-306.1zM610.1 372.3a8.03 8.03 0 00-11.3 0L372.3 598.7a8.03 8.03 0 000 11.3l39.6 39.6c3.1 3.1 8.2 3.1 11.3 0l226.4-226.4c3.1-3.1 3.1-8.2 0-11.3l-39.5-39.6z"></path>
        </svg>
      </div>
      <div tooltip="Télécharger le fichier pdf" tabindex="0" class="button display-none search--pdf-download--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="file-pdf" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M531.3 574.4l.3-1.4c5.8-23.9 13.1-53.7 7.4-80.7-3.8-21.3-19.5-29.6-32.9-30.2-15.8-.7-29.9 8.3-33.4 21.4-6.6 24-.7 56.8 10.1 98.6-13.6 32.4-35.3 79.5-51.2 107.5-29.6 15.3-69.3 38.9-75.2 68.7-1.2 5.5.2 12.5 3.5 18.8 3.7 7 9.6 12.4 16.5 15 3 1.1 6.6 2 10.8 2 17.6 0 46.1-14.2 84.1-79.4 5.8-1.9 11.8-3.9 17.6-5.9 27.2-9.2 55.4-18.8 80.9-23.1 28.2 15.1 60.3 24.8 82.1 24.8 21.6 0 30.1-12.8 33.3-20.5 5.6-13.5 2.9-30.5-6.2-39.6-13.2-13-45.3-16.4-95.3-10.2-24.6-15-40.7-35.4-52.4-65.8zM421.6 726.3c-13.9 20.2-24.4 30.3-30.1 34.7 6.7-12.3 19.8-25.3 30.1-34.7zm87.6-235.5c5.2 8.9 4.5 35.8.5 49.4-4.9-19.9-5.6-48.1-2.7-51.4.8.1 1.5.7 2.2 2zm-1.6 120.5c10.7 18.5 24.2 34.4 39.1 46.2-21.6 4.9-41.3 13-58.9 20.2-4.2 1.7-8.3 3.4-12.3 5 13.3-24.1 24.4-51.4 32.1-71.4zm155.6 65.5c.1.2.2.5-.4.9h-.2l-.2.3c-.8.5-9 5.3-44.3-8.6 40.6-1.9 45 7.3 45.1 7.4zm191.4-388.2L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.7-9.4-22.7zM790.2 326H602V137.8L790.2 326zm1.8 562H232V136h302v216a42 42 0 0042 42h216v494z"></path>
        </svg>
      </div>

      <div tabindex="-1" class="separator display-none document-drive-field-separator"></div>

      <div tooltip="Autres Traductions" tabindex="0" class="button display-none search--other-traduction--js" role="button">
        <svg viewBox="64 64 896 896" focusable="false" data-icon="translation" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M140 188h584v164h76V144c0-17.7-14.3-32-32-32H96c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h544v-76H140V188z"></path><path d="M414.3 256h-60.6c-3.4 0-6.4 2.2-7.6 5.4L219 629.4c-.3.8-.4 1.7-.4 2.6 0 4.4 3.6 8 8 8h55.1c3.4 0 6.4-2.2 7.6-5.4L322 540h196.2L422 261.4a8.42 8.42 0 00-7.7-5.4zm12.4 228h-85.5L384 360.2 426.7 484zM936 528H800v-93c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v93H592c-13.3 0-24 10.7-24 24v176c0 13.3 10.7 24 24 24h136v152c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V752h136c13.3 0 24-10.7 24-24V552c0-13.3-10.7-24-24-24zM728 680h-88v-80h88v80zm160 0h-88v-80h88v80z"></path>
        </svg>
      </div>
      <div tooltip="Écouter le document en audio" tabindex="0" class="button display-none search--audio-document--js" role="button">
        ${playIcon}
      </div>

    </div>
  </div>
`;

const controllerBarCss = /* css */ `
  .clearfix:before,
  .clearfix:after {
      content: ".";
      display: block;
      height: 0;
      overflow: hidden;
  }
  .clearfix:after { clear: both; }
  .clearfix { zoom: 1; }

  .controller--bar {
    height: 40px;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    justify-content: center;
  }

  .controller--bar .box {
    display: flex;
    justify-content: center;
    align-items: center;
    color: #000;
    width: 90%;
    max-width: 759px;
    height: 100%;
    z-index: 1;
    background-color: #ebe9e9;
    border-radius: 2px;
    border: 1px solid #b6b6b6;
    line-height: 19px;
    transition: all .2s linear;
    padding-top: 5px;
    padding-bottom: 5px;
    box-sizing: border-box;
  }

  .separator {
    border: 1px solid #adadad;
    height: 80%;
  }

  .box .disabled {
    opacity: .3;
    cursor: default;
  }

  .controller--bar .box .display-none {
    display: none ;
  }

  .box .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 33px;
    height: 70%;
    z-index: 10000;
    flex: initial;
    margin-left: 5px;
    margin-right: 5px;
    cursor: pointer;
  }

  .button svg {
    width: 100%;
    height: 100%;
  }

    /* START TOOLTIP STYLES */
  [tooltip] {
    position: relative; /* opinion 1 */
  }

  /* Applies to all tooltips */
  [tooltip]::before,
  [tooltip]::after {
    text-transform: none; /* opinion 2 */
    font-size: .9em; /* opinion 3 */
    line-height: 1;
    user-select: none;
    pointer-events: none;
    position: absolute;
    display: none;
    opacity: 0;
  }
  [tooltip]::before {
    content: '';
    border: 5px solid transparent; /* opinion 4 */
    z-index: 1001; /* absurdity 1 */
  }
  [tooltip]::after {
    content: attr(tooltip); /* magic! */

    /* most of the rest of this is opinion */
    font-family: Helvetica, sans-serif;
    text-align: center;

    /*
      Let the content set the size of the tooltips
      but this will also keep them from being obnoxious
      */
    min-width: 3em;
    max-width: 21em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 1ch 1.5ch;
    border-radius: .3ch;
    box-shadow: 0 1em 2em -.5em rgba(0, 0, 0, 0.35);
    background: #333;
    color: #fff;
    z-index: 1000; /* absurdity 2 */
  }

  /* Make the tooltips respond to hover */
  [tooltip]:hover::before,
  [tooltip]:hover::after {
    display: block;
  }

  /* don't show empty tooltips */
  [tooltip='']::before,
  [tooltip='']::after {
    display: none !important;
  }

  /* FLOW: UP */
  [tooltip]:not([flow])::before,
  [tooltip][flow^="up"]::before {
    bottom: 100%;
    border-bottom-width: 0;
    border-top-color: #333;
  }
  [tooltip]:not([flow])::after,
  [tooltip][flow^="up"]::after {
    bottom: calc(100% + 5px);
  }
  [tooltip]:not([flow])::before,
  [tooltip]:not([flow])::after,
  [tooltip][flow^="up"]::before,
  [tooltip][flow^="up"]::after {
    left: 50%;
    transform: translate(-50%, -.5em);
  }

  /* FLOW: DOWN */
  [tooltip][flow^="down"]::before {
    top: 100%;
    border-top-width: 0;
    border-bottom-color: #333;
  }
  [tooltip][flow^="down"]::after {
    top: calc(100% + 5px);
  }
  [tooltip][flow^="down"]::before,
  [tooltip][flow^="down"]::after {
    left: 50%;
    transform: translate(-50%, .5em);
  }

  /* FLOW: LEFT */
  [tooltip][flow^="left"]::before {
    top: 50%;
    border-right-width: 0;
    border-left-color: #333;
    left: calc(0em - 5px);
    transform: translate(-.5em, -50%);
  }
  [tooltip][flow^="left"]::after {
    top: 50%;
    right: calc(100% + 5px);
    transform: translate(-.5em, -50%);
  }

  /* FLOW: RIGHT */
  [tooltip][flow^="right"]::before {
    top: 50%;
    border-left-width: 0;
    border-right-color: #333;
    right: calc(0em - 5px);
    transform: translate(.5em, -50%);
  }
  [tooltip][flow^="right"]::after {
    top: 50%;
    left: calc(100% + 5px);
    transform: translate(.5em, -50%);
  }

  /* KEYFRAMES */
  @keyframes tooltips-vert {
    to {
      opacity: .9;
      transform: translate(-50%, 0);
    }
  }

  @keyframes tooltips-horz {
    to {
      opacity: .9;
      transform: translate(0, -50%);
    }
  }

  /* FX All The Things */
  [tooltip]:not([flow]):hover::before,
  [tooltip]:not([flow]):hover::after,
  [tooltip][flow^="up"]:hover::before,
  [tooltip][flow^="up"]:hover::after,
  [tooltip][flow^="down"]:hover::before,
  [tooltip][flow^="down"]:hover::after {
    animation: tooltips-vert 300ms ease-out forwards;
  }

  [tooltip][flow^="left"]:hover::before,
  [tooltip][flow^="left"]:hover::after,
  [tooltip][flow^="right"]:hover::before,
  [tooltip][flow^="right"]:hover::after {
    animation: tooltips-horz 300ms ease-out forwards;
  }
`;

// controller bar
// first resize container height
const container = pageContainer();
container.style.height = 'calc(100% - 50px)';

// insert html
document.body.appendChild(
  document.createRange().createContextualFragment(controllerBarHtml)
);

// insert css
injectStyleText(controllerBarCss);
