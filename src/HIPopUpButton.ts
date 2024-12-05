/*
 *  HIPopUpButton.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/27.
 *  Copyright © 2024 alphaArgon.
 */

import { HIButton } from "./HIButton.js";
import { HIButtonCell } from "./HIButtonCell.js";
import { HIPopUpButtonCell } from "./HIPopUpButtonCell.js";
import { HIControlState } from "./HIControl.js";
import { HIMenu, HIMenuItem } from "./HIMenu.js";
import { HINotificationCenter, HINotification } from "./HINotification.js";
import type { HIEvent, HISelector } from "./HIResponder.js";
import type { HIImage } from "./HIImage.js";
import type { HIMenuSPI } from "./_HIInternal.js";


export class HIPopUpButton extends HIButton {

    private _title: string;
    private _image: Nullable<HIImage>;
    private _menu: HIMenu;
    private _itemIndex: number;

    public constructor(target: Nullable<{}>, action: Nullable<HISelector>, pullsDown: boolean = false) {
        super("", target, action);
        (this.cell as HIPopUpButtonCell).pullsDown = pullsDown;

        this._title = "";
        this._image = null;
        this._menu = new HIMenu();
        this._itemIndex = -1;

        //  We don’t need to remove these observers; it won’t cause memory leak.
        HINotificationCenter.default.addObserver(this, "menuDidAddItem", HIMenu.didAddItemNotification, this._menu);
        HINotificationCenter.default.addObserver(this, "menuDidRemoveItem", HIMenu.didRemoveItemNotification, this._menu);
        HINotificationCenter.default.addObserver(this, "menuDidChangeItem", HIMenu.didChangeItemNotification, this._menu);
        HINotificationCenter.default.addObserver(this, "menuDidClose", HIMenu.didEndTrackingNotification, this._menu);
    }

    protected static override makeDOM(): HTMLElement {
        let dom = super.makeDOM();
        dom.classList.add("hi-pop-up-button");
        return dom;
    }

    protected static override makeCell(): HIButtonCell {
        return new HIPopUpButtonCell();
    }

    public override get title(): string {
        return this._title;
    }

    public override set title(title: string) {
        this._title = title;
        if ((this.cell as HIPopUpButtonCell).pullsDown) {
            super.title = title;
        }
    }

    public override get image(): Nullable<HIImage> {
        return this._image;
    }

    public override set image(image: Nullable<HIImage>) {
        this._image = image;
        if ((this.cell as HIPopUpButtonCell).pullsDown) {
            super.image = image;
        }
    }

    public get menu(): HIMenu {
        return this._menu;
    }

    public addItem(title: string): void {
        this._menu.addItem(title, null);
    }

    private _syncTitleAndImage(): void {
        if ((this.cell as HIPopUpButtonCell).pullsDown) {
            super.title = this._title;
            super.image = this._image;

        } else if (this._itemIndex === -1) {
            super.title = "";
            super.image = null;

        } else {
            let item = this._menu.items[this._itemIndex];
            super.title = item.title;
            super.image = item.image;
        }
    }

    private _selectItemAt(itemIndex: number): void {
        let oldIndex = this._itemIndex;
        if (itemIndex === oldIndex) {return;}

        this._itemIndex = itemIndex;
        if ((this.cell as HIPopUpButtonCell).pullsDown) {return;}

        this._syncTitleAndImage();

        if (oldIndex !== -1) {
            let item = this._menu.items[oldIndex];
            item.state = HIControlState.off;
        }

        if (itemIndex !== -1) {
            let item = this._menu.items[itemIndex];
            item.state = HIControlState.on;
        }
    }

    /** Whether the button is a pop-up option selector, or a pull-down action selector.
      * 
      * Unlike `NSPopUpButton`, `HIPopUpButton` won’t use the first menu item as the title or image
      * of the button; instead, it respects the `title` and `image` properties. */
    public get pullsDown(): boolean {
        return (this.cell as HIPopUpButtonCell).pullsDown;
    }

    public set pullsDown(pullsDown: boolean) {
        if (pullsDown === (this.cell as HIPopUpButtonCell).pullsDown) {return;}
        (this.cell as HIPopUpButtonCell).pullsDown = pullsDown;

        if (!pullsDown && this._itemIndex === 1 && this._menu.items.length !== 0) {
            this._selectItemAt(0);

        } else if (pullsDown && this._itemIndex !== -1) {
            this._syncTitleAndImage();
            this._menu.items[this._itemIndex].state = HIControlState.off;

        } else {
            this._syncTitleAndImage();
        }
    }

    public get indexOfSelectedItem(): number {
        return this._itemIndex;
    }

    public set indexOfSelectedItem(itemIndex: number) {
        if (itemIndex < -1 || itemIndex >= this._menu.items.length) {
            throw new RangeError("Index out of range.");
        }

        this._selectItemAt(itemIndex);
    }

    public menuDidAddItem(notification: HINotification<number>): void {
        if (notification.sender !== this._menu) {return;}
        let itemIndex = notification.userInfo;
        if (itemIndex <= this._itemIndex) {
            this._itemIndex += 1;
        } else if (this._itemIndex === -1 && !this.pullsDown) {
            this._selectItemAt(itemIndex);
        }
    }

    public menuDidRemoveItem(notification: HINotification<number>): void {
        if (notification.sender !== this._menu) {return;}
        let itemIndex = notification.userInfo;
        if (itemIndex === this._itemIndex) {
            this._itemIndex = -1;
            this._syncTitleAndImage();
        } else if (itemIndex < this._itemIndex) {
            this._itemIndex -= 1;
        }
    }

    public menuDidChangeItem(notification: HINotification<number>): void {
        if (notification.sender !== this._menu) {return;}
        let itemIndex = notification.userInfo;
        if (itemIndex === this._itemIndex) {
            this._syncTitleAndImage();
        }
    }

    public menuDidClose(notification: HINotification<void>): void {
        if (notification.sender !== this._menu) {return;}
        this.cell.isHighlighted = false;
    }

    private _openMenu(): void {
        if (this._menu.items.length === 0) {return;}
        this.cell.isHighlighted = true;

        for (let item of this._menu.items) {
            if (item.action === null && item.target === null && !item.isSeparator) {
                item.action = "_popUpItemAction";
                item.target = this;
            }
        }

        (this._menu as any as HIMenuSPI)._popUpPopUpButton(this);
    }

    private _popUpItemAction(item: HIMenuItem): void {
        let index = this._menu.items.indexOf(item);
        this._selectItemAt(this._menu.items.indexOf(item));
        if (this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDown(event);
        }

        this._openMenu();
    }

    public override mouseDragged(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDown(event);
        }
    }

    public override mouseUp(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseUp(event);
        }
    }

    public override performClick(sender?: any): void {
        if (!this.isEnabled) {return;}
        this._openMenu();
    }
}
