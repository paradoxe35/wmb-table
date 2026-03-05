/**
 * Custom context menu for CKEditor notes — ported from modules/context-menu/context.js
 * Original author: @UnrealSec
 */

interface ContextMenuItem {
    text: string;
    onclick?: (event: { handled: boolean; item: HTMLElement; data: ContextMenuItem }) => void;
    hotkey?: string;
    color?: string;
    disabled?: boolean;
    subitems?: ContextMenuItem[];
}

export class ContextMenu {
    container: HTMLElement;
    dom: HTMLElement | null = null;
    shown = false;
    root = true;
    parent: ContextMenu | null = null;
    submenus: ContextMenu[] = [];
    items: (ContextMenuItem | null)[];

    private _onclick: (e: MouseEvent) => void;
    private _oncontextmenu: (e: MouseEvent) => void;
    private _oncontextmenu_keydown: (e: KeyboardEvent) => void;
    private _onblur: () => void;

    constructor(container: HTMLElement, items: (ContextMenuItem | null)[]) {
        this.container = container;
        this.items = items;

        this._onclick = (e) => {
            if (
                this.dom &&
                e.target !== this.dom &&
                (e.target as HTMLElement).parentElement !== this.dom &&
                !(e.target as HTMLElement).classList.contains('item') &&
                !(e.target as HTMLElement).parentElement?.classList.contains('item')
            ) {
                this.hideAll();
            }
        };

        this._oncontextmenu = (e) => {
            e.preventDefault();
            if (
                e.target !== this.dom &&
                (e.target as HTMLElement).parentElement !== this.dom &&
                !(e.target as HTMLElement).classList.contains('item') &&
                !(e.target as HTMLElement).parentElement?.classList.contains('item')
            ) {
                this.hideAll();
                this.show(e.clientX, e.clientY);
            }
        };

        this._oncontextmenu_keydown = (e) => {
            if (e.keyCode !== 93) return;
            e.preventDefault();
            this.hideAll();
            this.show(0, 0);
        };

        this._onblur = () => {
            this.hideAll();
        };
    }

    private getMenuDom(): HTMLElement {
        const menu = document.createElement('div');
        menu.classList.add('context');
        for (const item of this.items) {
            menu.appendChild(this.itemToDomEl(item));
        }
        return menu;
    }

    private itemToDomEl(data: ContextMenuItem | null): HTMLElement {
        const item = document.createElement('div');

        if (data === null) {
            item.className = 'separator';
            return item;
        }

        if (data.color && /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(data.color)) {
            item.style.cssText = `color: ${data.color}`;
        }

        item.classList.add('item');

        const label = document.createElement('span');
        label.className = 'label';
        label.innerText = data.text ?? '';
        item.appendChild(label);

        if (data.disabled) {
            item.classList.add('disabled');
        } else {
            item.classList.add('enabled');
        }

        const hotkey = document.createElement('span');
        hotkey.className = 'hotkey';
        hotkey.innerText = data.hotkey ?? '';
        item.appendChild(hotkey);

        if (data.subitems && data.subitems.length > 0) {
            const submenu = new ContextMenu(this.container, data.subitems);
            submenu.root = false;
            submenu.parent = this;

            const openSubItems = () => {
                if (data.disabled) return;
                this.hideSubMenus();
                const x = this.dom!.offsetLeft + this.dom!.clientWidth + item.offsetLeft;
                const y = this.dom!.offsetTop + item.offsetTop;
                if (!submenu.shown) submenu.show(x, y);
                else submenu.hide();
            };

            this.submenus.push(submenu);
            item.classList.add('has-subitems');
            item.addEventListener('click', openSubItems);
            item.addEventListener('mousemove', openSubItems);
        } else {
            item.addEventListener('click', () => {
                this.hideSubMenus();
                if (item.classList.contains('disabled')) return;

                if (typeof data.onclick === 'function') {
                    const event = { handled: false, item, data };
                    data.onclick(event);
                    if (!event.handled) this.hide();
                } else {
                    this.hide();
                }
            });

            item.addEventListener('mousemove', () => {
                this.hideSubMenus();
            });
        }

        return item;
    }

    hideAll(): void {
        if (this.root && !this.parent) {
            if (this.shown) {
                this.hideSubMenus();
                this.shown = false;
                this.container.removeChild(this.dom!);
            }
            return;
        }
        this.parent?.hide();
    }

    hide(): void {
        if (this.dom && this.shown) {
            this.shown = false;
            this.hideSubMenus();
            this.container.removeChild(this.dom);
            if (this.parent?.shown) this.parent.hide();
        }
    }

    hideSubMenus(): void {
        for (const menu of this.submenus) {
            if (menu.shown) {
                menu.shown = false;
                menu.container.removeChild(menu.dom!);
            }
            menu.hideSubMenus();
        }
    }

    show(x: number, y: number): void {
        this.dom = this.getMenuDom();
        this.dom.style.display = 'block';

        const pageWidth =
            document.documentElement.clientWidth + document.documentElement.scrollLeft;
        const pageHeight =
            document.documentElement.clientHeight + document.documentElement.scrollTop;

        if (x + this.dom.offsetWidth > pageWidth) {
            x = pageWidth - this.dom.offsetWidth - 1;
        }
        if (y + this.dom.offsetHeight > pageHeight) {
            y = pageHeight - this.dom.offsetHeight - 1;
        }

        this.dom.style.left = `${x}px`;
        this.dom.style.top = `${y}px`;

        this.shown = true;
        this.container.appendChild(this.dom);
    }

    install(): void {
        this.container.addEventListener('contextmenu', this._oncontextmenu);
        this.container.addEventListener('keydown', this._oncontextmenu_keydown);
        this.container.addEventListener('click', this._onclick);
        window.addEventListener('blur', this._onblur);
    }

    uninstall(): void {
        this.dom = null;
        this.container.removeEventListener('contextmenu', this._oncontextmenu);
        this.container.removeEventListener('keydown', this._oncontextmenu_keydown);
        this.container.removeEventListener('click', this._onclick);
        window.removeEventListener('blur', this._onblur);
    }
}
