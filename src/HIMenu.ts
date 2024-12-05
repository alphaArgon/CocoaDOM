/*
 *  HIMenu.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/21.
 *  Copyright © 2024 alphaArgon.
 */

import { HIWindow, HIWindowLevel } from "./HIWindow.js";
import { HIAnimator, HIRectInterpolation } from "./HIAnimator.js";
import { HINotificationCenter, HINotificationName } from "./HINotification.js";
import { HIView } from "./HIView.js";
import { HIControlState } from "./HIControl.js";
import { HIColor } from "./HIColor.js";
import { HIImage } from "./HIImage.js";
import { HITrackingArea, HITrackingAreaOptions } from "./HITrackingArea.js";
import { HIEvent, HISelector } from "./HIResponder.js";
import { RangeSet } from "./RangeSet.js";
import { HIFindDirectChildDOMFrom, HIGetReadonlyProxy, HISetDOMHasAttribute, HISetDOMState } from "./_HIUtils.js";
import { _HIApplyTranslucencyForDOM, _HITranslucentStyle } from "./_HIVisualEffect.js";
import { _HIAlignScanCoord, _HIAlignScanRect, _HIWithFreeSizeOfDOM } from "./_HISharedLayout.js";
import type { HIPoint, HIRect } from "./HIGeometry.js";
import type { HIPopUpButton } from "./HIPopUpButton.js";
import type { HIValidatedUserInterfaceItem } from "./HIUserInterfaceValidations.js";
import type { HIWindowSPI } from "./_HIInternal.js";


export class HIMenuItem implements HIValidatedUserInterfaceItem {

    private _menu: Nullable<HIMenu>;

    //  Separator item won’t send `itemChanged` message.
    private _separator: boolean;

    private _title: string;
    private _image: Nullable<HIImage>;
    private _state: HIControlState;
    private _enabled: boolean;

    //  SPI to `_HIMenuItemCell`
    private _changedKey: Nullable<keyof HIMenuItem>;

    private _target: Nullable<{}>;
    private _action: Nullable<HISelector>;

    private _stateImages: [Nullable<HIImage>, Nullable<HIImage>, Nullable<HIImage>];

    public constructor(title: string, action: Nullable<HISelector>) {
        this._menu = null;
        this._separator = false;
        this._title = title;
        this._image = null;
        this._state = HIControlState.off;
        this._enabled = true;
        this._changedKey = null;
        this._target = null;
        this._action = action;
        this._stateImages = [null, null, null];
    }

    public static separator(): HIMenuItem {
        let item = new HIMenuItem("", null);
        item._enabled = false;
        item._separator = true;
        return item;
    }

    public get menu(): Nullable<HIMenu> {
        return this._menu;
    }

    public get title(): string {
        return this._title;
    }

    public set title(value: string) {
        if (this._separator) {return;}
        this._title = value;

        this._changedKey = "title";
        this._menu?.itemChanged(this);
        this._changedKey = null;
    }

    public get image(): Nullable<HIImage> {
        return this._image;
    }

    public set image(value: Nullable<HIImage>) {
        if (this._separator) {return;}
        this._image = value;

        this._changedKey = "image";
        this._menu?.itemChanged(this);
        this._changedKey = null;
    }

    public get state(): HIControlState {
        return this._state;
    }

    public set state(value: HIControlState) {
        if (this._separator) {return;}
        this._state = value;

        this._changedKey = "state";
        this._menu?.itemChanged(this);
        this._changedKey = null;
    }

    public get isEnabled(): boolean {
        return this._enabled;
    }

    public set isEnabled(value: boolean) {
        if (this._separator) {return;}
        this._enabled = value;

        this._changedKey = "isEnabled";
        this._menu?.itemChanged(this);
        this._changedKey = null;
    }

    public get target(): Nullable<{}> {
        return this._target;
    }

    public set target(value: Nullable<{}>) {
        if (this._separator) {return;}
        this._target = value;
    }

    public get action(): Nullable<HISelector> {
        return this._action;
    }

    public set action(value: Nullable<HISelector>) {
        if (this._separator) {return;}
        this._action = value;
    }

    public get isSeparator(): boolean {
        return this._separator;
    }

    public imageFor(state: HIControlState): Nullable<HIImage> {
        let image = this._stateImages[state + 1];
        if (image === null) {
            if (state === HIControlState.on) {image = HIImage.menuStateOn;}
            else if (state === HIControlState.mixed) {image = HIImage.menuStateMixed;}
        }

        return image;
    }

    public setImageFor(state: HIControlState, image: Nullable<HIImage>): void {
        this._stateImages[state + 1] = image;
    }
}


export class HIMenu {

    public static readonly didAddItemNotification: HINotificationName<number> = "HIMenuDidAddItemNotification";
    public static readonly didRemoveItemNotification: HINotificationName<number> = "HIMenuDidRemoveItemNotification";
    public static readonly didChangeItemNotification: HINotificationName<number> = "HIMenuDidChangeItemNotification";

    public static readonly didBeginTrackingNotification: HINotificationName<void> = "HIMenuDidBeginTrackingNotification";    
    public static readonly didEndTrackingNotification: HINotificationName<void> = "HIMenuDidEndTrackingNotification";

    public static readonly willSendActionNotification: HINotificationName<HIMenuItem> = "HIMenuWillSendActionNotification";
    public static readonly didSendActionNotification: HINotificationName<HIMenuItem> = "HIMenuDidSendActionNotification";

    private readonly _items: HIMenuItem[];
    private _view: Nullable<_HIMenuView>;

    public constructor() {
        this._items = [];
        this._view = null;
    }

    public get items(): readonly HIMenuItem[] {
        return HIGetReadonlyProxy(this._items);
    }

    public addItem(item: HIMenuItem): void;
    public addItem(title: string, action: Nullable<HISelector>): void;
    public addItem(arg: HIMenuItem | string, action?: Nullable<HISelector>): void {
        let item = typeof arg === "string" ? new HIMenuItem(arg, action === undefined ? null : action) : arg;
        this.insertItem(item, this._items.length);
    }

    public insertItem(item: HIMenuItem, index: number): void {
        if (index < 0 || index > this._items.length) {
            throw new RangeError(`Index ${index} out of bounds 0...${this._items.length}`);
        }

        if (item.menu !== null) {
            item.menu.removeItemAt(item.menu.items.indexOf(item));
        }

        (item as any)._menu = this;
        this._items.splice(index, 0, item);
        this._view?.didInsertItemAt(index);
        HINotificationCenter.default.post(HIMenu.didAddItemNotification, this, index);
    }

    public removeItemAt(index: number): void {
        if (index < 0 || index >= this._items.length) {
            throw new RangeError(`Index ${index} out of bounds 0..<${this._items.length}`);
        }

        let item = this._items[index];
        (item as any)._menu = null;
        this._items.splice(index, 1);
        this._view?.didRemoveItemAt(index);
        HINotificationCenter.default.post(HIMenu.didRemoveItemNotification, this, index);
    }

    public itemChanged(item: HIMenuItem): void {
        let index = this._items.indexOf(item);
        if (index < 0) {
            throw new RangeError("Item not found in the menu");
        }

        this._view?.didChangeItemAt(index);
        HINotificationCenter.default.post(HIMenu.didChangeItemNotification, this, index);
    }

    /** Returns the index to the first item whose title mostly starts with the given character. */
    public indexOfItemForCharacter(character: string, loopFrom: number = 0): number {
        let bestIndex = -1;
        let minDistance = Infinity;

        let targetCodePoint = character[0].toLowerCase().codePointAt(0)!;

        for (let c = 0; c < this._items.length; ++c) {
            let i = (loopFrom + c) % this._items.length
            let item = this._items[i];
            if (!item.isEnabled) {continue;}
            if (item.title.length === 0) {continue;}

            let prefixCodePoint = item.title[0].toLowerCase().codePointAt(0)!;
            let distance = prefixCodePoint - targetCodePoint;

            if (distance < 0) {
                continue;

            } else if (distance === 0) {
                return i;

            } else if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i;

            } else if (distance === minDistance) {
                let bestItem = this._items[bestIndex];
                let newItem = this._items[i];
                if (newItem.title.length < bestItem.title.length) {
                    bestIndex = i;
                }
            }
        }

        return bestIndex;
    }

    public update(): void {
        if (this._view === null) {
            this._view = new _HIMenuView(this);
        }

        //  TODO: ...
    }

    public popUpContextMenu(event: HIEvent<MouseEvent>, forView: HIView): void {
        this.update();
        let rect = {x: event.native.clientX, y: event.native.clientY, width: 0, height: 0};
        this._view!.openAround(rect, -1, forView);
    }

    public popUpPositioningItem(item: Nullable<HIMenuItem>, forView: HIView, locationInDOM?: HIPoint): void {
        this.update();
        let {x, y} = forView.dom.getBoundingClientRect();
        x += window.scrollX + (locationInDOM?.x || 0);
        y += window.scrollY + (locationInDOM?.y || 0);
        this._view!.openAround({x, y, width: 0, height: 0}, this._items.indexOf(item!), forView);
    }

    /** @internal SPI to `HIPopUpButton` */
    private _popUpPopUpButton(popUpButton: HIPopUpButton): void {
        this.update();

        let itemIndex = popUpButton.pullsDown ? -1 : popUpButton.indexOfSelectedItem;

        let bezelDOM = popUpButton.cell.dom;
        let bezelRect = bezelDOM.getBoundingClientRect();

        let openRect: HIRect;

        if (itemIndex !== -1 && bezelDOM.childElementCount > 1) {
            let firstContentRect = bezelDOM.children[1].getBoundingClientRect();
            openRect = {x: firstContentRect.x, y: bezelRect.y, width: 0, height: 0};
        } else {
            openRect = {x: bezelRect.x, y: bezelRect.y, width: bezelRect.width, height: bezelRect.height};
            openRect.y -= 1;
            openRect.height += 2;
        }

        openRect.x += window.scrollX;
        openRect.y += window.scrollY;

        this._view!.openAround(openRect, itemIndex, popUpButton, itemIndex !== -1);
    }
}


class _HIMenuView extends HIView {

    private readonly _menu: HIMenu;
    private readonly _contentDOM: HTMLElement;

    private readonly _rows: {item: HIMenuItem, dom: HTMLElement, cell: Nullable<_HIMenuItemCell>}[];
    private _accDelta: number;

    private _highlightedIndex: number;
    private _initialIndex: number;
    private _hotIndex: number;
    private _opaque: boolean;

    private _mouseDownAt: number;
    private _mouseOnceReleased: boolean;

    private _allowsUpdate: boolean;

    /** Indices to the items that should be updated before next opening. */
    private _dirtyIndices: RangeSet;

    private readonly _backdropDOM: HTMLElement;
    private readonly _highlightDOM: HTMLElement;
    private _buttonCapDOM: Nullable<HTMLElement>;
    private _fromButton: boolean;
    private _contextView: Nullable<HIView>;

    private _flashTimer: number;

    public constructor(menu: HIMenu) {
        super();
        this._menu = menu;
        this._contentDOM = document.createElement("div");
        this._contentDOM.classList.add("hi-menu-content");
        this.dom.appendChild(this._contentDOM);

        this._rows = menu.items.map((_, index) => {
            let row = this._makeRowAt(index);
            this._contentDOM.appendChild(row.dom);
            return row;
        });

        this._accDelta = 0;
        this._highlightedIndex = -1;
        this._initialIndex = -1;
        this._hotIndex = -1;
        this._allowsUpdate = false;
        this._opaque = false;
        this._mouseDownAt = -1;
        this._mouseOnceReleased = false

        this._dirtyIndices = new RangeSet(0, this._rows.length);

        this.addTrackingArea(new HITrackingArea(this._contentDOM, HITrackingAreaOptions.mouseEnteredAndExited | HITrackingAreaOptions.mouseMoved));

        this._backdropDOM = document.createElement("div");
        this._backdropDOM.classList.add("hi-menu-backdrop");
        this._highlightDOM = document.createElement("div");
        this._highlightDOM.classList.add("hi-menu-backdrop", "selection");
        this._contentDOM.prepend(this._backdropDOM, this._highlightDOM);

        _HIApplyTranslucencyForDOM(this._backdropDOM, _HITranslucentStyle.thin);
        _HIApplyTranslucencyForDOM(this._highlightDOM, _HITranslucentStyle.emphasizedSelection);

        this._buttonCapDOM = null;
        this._fromButton = false;

        this._contextView = null;
        this._flashTimer = 0;
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-menu");
        dom.role = "menu";
        return dom;
    }

    private _makeRowAt(index: number): {item: HIMenuItem, dom: HTMLElement, cell: Nullable<_HIMenuItemCell>} {
        let item = this._menu.items[index];
        if (item.isSeparator) {
            let dom = document.createElement("hr");
            dom.classList.add("hi-menu-separator");
            return {item, dom, cell: null};
        } else {
            let cell = new _HIMenuItemCell();
            let dom = document.createElement("div");
            dom.classList.add("hi-menu-item");
            dom.role = "menuitem";
            dom.appendChild(cell.dom);
            return {item, dom, cell};
        }
    }

    private _updateDirtyItems(): void {
        for (let index of this._dirtyIndices) {
            let row = this._rows[index];
            row.cell?.update(row.item);
        }
        this._dirtyIndices.removeAll();
    }

    public didInsertItemAt(index: number): void {
        let row = this._makeRowAt(index);
        index === this._rows.length
            ? this._contentDOM.appendChild(row.dom)
            : this._contentDOM.insertBefore(row.dom, this._rows[index].dom);
        this._rows.splice(index, 0, row);

        row.cell?.update(row.item);
        this._dirtyIndices.insertGapIn(index, index + 1);
    }

    public didRemoveItemAt(index: number): void {
        this._rows[index].dom.remove();
        this._rows.splice(index, 1);
        this._dirtyIndices.removeSpanIn(index, index + 1);
    }

    public didChangeItemAt(index: number): void {
        if (this._allowsUpdate) {
            let row = this._rows[index];
            row.cell?.update(row.item);
        } else {
            this._dirtyIndices.insert(index, index + 1);
        }
    }

    public offsetOfItemAt(index: number): HIPoint {
        let y = this._rows[index].dom.offsetTop;
        let x = this._rows[index].cell === null ? 0 : _HIMenuItemCellInset;
        return {x, y};
    }

    /** The distance from the top left corner to the origin of the content.
      * 
      * If the menu is fully opaque, the outset is the scroll position; otherwise, it’s the negative
      * margin. Doing so may optimize the animation behavior. */
    public get originOutset(): HIPoint {
        let marginX = parseFloat(this._contentDOM.style.marginLeft || "0");
        let marginY = parseFloat(this._contentDOM.style.marginTop || "0");
        let x = this.dom.scrollLeft - marginX;
        let y = this.dom.scrollTop - marginY;
        return {x, y};
    }

    public set originOutset(value: HIPoint) {
        let useScroll = this._opaque;
        if (useScroll) {
            this._contentDOM.style.marginLeft = "";
            this._contentDOM.style.marginTop = "";
            this.dom.scrollLeft = value.x;
            this.dom.scrollTop = value.y;
        } else {
            this._contentDOM.style.marginLeft = -value.x + "px";
            this._contentDOM.style.marginTop = -value.y + "px";
            this.dom.scrollLeft = 0;
            this.dom.scrollTop = 0;
        }
    }

    public get popUpButtonAnimationData(): Nullable<{rect: HIRect, index: number}> {
        if (!this._fromButton) {return null;}
        let {x, y, width, height} = (this._contextView as HIPopUpButton).cell.dom.getBoundingClientRect();
        x += window.scrollX;
        y += window.scrollY;
        return {rect: {x, y, width, height}, index: this._hotIndex === -1 ? this._initialIndex : this._hotIndex};
    }

    public openAround(rect: HIRect, itemIndex: number, inView: HIView, fromButton: boolean = false): void {
        if (this._flashTimer !== 0) {
            clearInterval(this._flashTimer);
            this._flashTimer = 0;
        }

        this._updateDirtyItems();
        this._opaque = true;
        this._allowsUpdate = true;

        let window = this.window as _HIMenuWindow;
        if (window === null) {
            window = new _HIMenuWindow(this);
        }

        let minWidth = 0;
        if (fromButton) {
            minWidth = (inView as HIPopUpButton).cell.dom.getBoundingClientRect().width;
            minWidth += 8;  //  This is magic.
        }

        window.appearance = inView.effectiveAppearance;
        window.openAround(rect, itemIndex, minWidth);

        if ((window as any as HIWindowSPI)._claimMouseSession(this, inView.window)) {
            this._mouseDownAt = HIEvent.current!.native.timeStamp;
            this._mouseOnceReleased = false;
        } else {
            this._mouseDownAt = -1;
            this._mouseOnceReleased = true;
        }

        this._initialIndex = itemIndex;
        this._contextView = inView;

        this.dom.classList.remove("fading-state-column");

        this._fromButton = fromButton;
        if (fromButton) {
            if (this._buttonCapDOM === null) {
                this._buttonCapDOM = document.createElement("div");
                this._buttonCapDOM.classList.add("hi-menu-backdrop", "button-cap");
                this._buttonCapDOM.innerHTML = HIPopUpTopArrowSVG + HIPopUpBottomArrowSVG;
                this.dom.appendChild(this._buttonCapDOM);
            }

            this._buttonCapDOM.style.left = "auto";
            this._buttonCapDOM.style.width = "16px";

        } else {
            if (this._buttonCapDOM !== null) {
                this._buttonCapDOM.remove();
                this._buttonCapDOM = null;
            }
        }

        this._highlightItemAt(itemIndex, true);
        HINotificationCenter.default.post(HIMenu.didBeginTrackingNotification, this._menu);
    }

    public closeAnimated(animated: boolean, hotIndex: number = -1) {
        if (!this._opaque) {return;}
        this._opaque = false;
        this._allowsUpdate = false;
        this._hotIndex = hotIndex;
        this._highlightItemAt(-1);

        let fromButton = this._fromButton;

        let closeWindow = () => {
            if (fromButton) {
                this.dom.classList.add("fading-state-column");
            }

            this.window!.orderOut();
            this._contextView = null;
            HINotificationCenter.default.post(HIMenu.didEndTrackingNotification, this._menu);
        }

        if (hotIndex === -1) {
            closeWindow();
        } else {
            //  The menu needs to flash and perform the hot item.
            let hotWindow = this._contextView?.window;
            let hotItem = this._rows[hotIndex].item;

            let flashCount = fromButton ? 2 : 1;
            let singleFlashDuration = 100 / flashCount;

            this._flashTimer = setInterval(() => {
                flash: {
                    let hotItemValid = this._rows[hotIndex]?.item === hotItem;
                    if (!hotItemValid) {
                        this._hotIndex = -1;
                        this._initialIndex = -1;
                        break flash;
                    }

                    this._highlightedIndex === -1
                        ? this._highlightItemAt(hotIndex)
                        : this._highlightItemAt(-1);
                    flashCount -= 1;

                    if (flashCount === 0) {
                        //  Perform action on the last flash.
                        if (hotItem.action !== null && hotItem.isEnabled) {
                            HINotificationCenter.default.post(HIMenu.willSendActionNotification, this._menu, hotItem);
                            hotWindow?.sendAction(hotItem.action, hotItem.target, hotItem);
                            HINotificationCenter.default.post(HIMenu.didSendActionNotification, this._menu, hotItem);
                        }            

                        break flash;
                    }
                    return;
                }

                clearInterval(this._flashTimer);
                this._flashTimer = 0;
                closeWindow();

            }, singleFlashDuration);
        }
    }

    private _highlightItemAt(index: number, force: boolean = false): void {
        let oldIndex = this._highlightedIndex;
        if (oldIndex === index && !force) {return;}

        if (oldIndex !== -1) {
            this._rows[oldIndex].cell?.setHighlighted(false);
        }

        let highlightTop = 0;
        let highlightHeight = 0;

        if (index !== -1) {
            this._rows[index].cell?.setHighlighted(true);
            highlightTop = this._rows[index].dom.offsetTop;
            highlightHeight = this._rows[index].dom.offsetHeight;
        }

        this._highlightedIndex = index;

        //  Safari has a bug that, once an element is zero-sized, the backdrop filter won’t work
        //  anymore. So rather than setting the height to 0, we set it to 1px and hide it.
        if (highlightHeight === 0) {
            this._highlightDOM.style.top = "0";
            this._highlightDOM.style.height = "1px";
            this._highlightDOM.style.display = "none";
            this._highlightDOM.style.clipPath = "";
            this._backdropDOM.style.clipPath = "";

        } else {
            let height = this.window!.frame.height;
            let outsetY = this.originOutset.y;
            const inset = 4;

            if (highlightTop - inset < outsetY) {
                this.originOutset = {x: 0, y: highlightTop - inset};
            } else if (highlightTop + highlightHeight + inset > outsetY + height) {
                this.originOutset = {x: 0, y: highlightTop + highlightHeight + inset - height};
            }

            this._highlightDOM.style.top = (highlightTop - 5) + "px";
            this._highlightDOM.style.height = (highlightHeight + 10) + "px";
            this._highlightDOM.style.clipPath = "inset(5px 0 5px 0)";
            this._highlightDOM.style.display = "";

            //  We make a hole in the backdrop for the highlighted item.
            this._backdropDOM.style.clipPath = "polygon(0 0, w 0, w h, 0 h, 0 b, w b, w t, 0 t)"
                .replace(/(w|h|t|b)/g, match => {
                    switch (match) {
                    case "w": return "100%";
                    case "h": return "100%";
                    case "t": return highlightTop + "px";
                    case "b": return (highlightTop + highlightHeight) + "px";
                    default: return match;
                    }
                });
        }
    }

    private _enabledIndexFor(event: HIEvent<MouseEvent>): number {
        let rowDOM = HIFindDirectChildDOMFrom(event.native.target as HTMLElement, this._contentDOM);
        let index = rowDOM === null ? -1 : this._rows.findIndex(row => row.dom === rowDOM);
        if (index !== -1 && this._rows[index].item.isEnabled) {return index;}
        return -1;
    }

    public get hotIndex(): number {
        return this._hotIndex;
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}
        this._highlightItemAt(this._enabledIndexFor(event));
    }

    public override mouseDragged(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}
        this._highlightItemAt(this._enabledIndexFor(event));
    }

    public override mouseUp(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}

        let index = this._enabledIndexFor(event);
        this._highlightItemAt(index);

        const autoselectDelay = 300;
        if (!this._mouseOnceReleased) {
            if (event.native.timeStamp - this._mouseDownAt > autoselectDelay) {
                this.closeAnimated(true, index);
            }
        } else if (index !== -1) {
            this.closeAnimated(true, index);
        }

        this._mouseOnceReleased = true;
    }

    public override mouseMoved(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}
        this._highlightItemAt(this._enabledIndexFor(event));
    }

    public override mouseEntered(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}
        let index = this._enabledIndexFor(event);
        if (index === -1) {return;}
        this._highlightItemAt(index);
    }

    public override mouseExited(event: HIEvent<MouseEvent>): void {
        if (!this._opaque) {return;}
        this._highlightItemAt(-1);
    }

    public override scrollWheel(event: HIEvent<WheelEvent>): void {
        if (!this._opaque) {return;}
        const step = 19;
        this._accDelta += event.native.deltaY;
        let steps = Math.trunc(this._accDelta / step);
        this.dom.scrollTop += steps * step;
        this._accDelta -= steps * step;
    }

    public override keyDown(event: HIEvent<KeyboardEvent>): void {
        let index = -1;

        switch (event.native.key) {
        case " ":
        case "Enter":
            return this.closeAnimated(true, this._highlightedIndex);

        case "Escape":
            return this.closeAnimated(true);

        case "ArrowUp":
            index = this._highlightedIndex === -1 ? this._rows.length : this._highlightedIndex;
            while (index > 0) {
                index -= 1;
                if (this._rows[index].item.isEnabled) {break;}
            }
            break;

        case "ArrowDown":
            index = this._highlightedIndex;  //  Could be -1.
            while (index < this._rows.length - 1) {
                index += 1;
                if (this._rows[index].item.isEnabled) {break;}
            }
            break;

        default:
            if (event.native.key.length === 1 && !event.isMetaKeyDown) {
                index = this._menu.indexOfItemForCharacter(event.native.key, this._highlightedIndex + 1);
            }
            break;
        }

        if (index !== -1) {
            this._highlightItemAt(index);
        }
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return true;
    }

    public override get acceptsFirstResponder(): boolean {
        return true;
    }
}


class _HIMenuWindow extends HIWindow {

    private _savedKeyWindow: Nullable<HIWindow>;

    public constructor(contentView: _HIMenuView) {
        super();
        this.level = HIWindowLevel.popUpMenu;
        this.backgroundColor = HIColor.clear;
        this.contentView = contentView;
        (this as any as HIWindowSPI)._frameView.frameDOM.classList.add("hi-menu-window");
        this._savedKeyWindow = null;
    }

    public openAround(rect: HIRect, itemIndex: number, minWidth: number): void {
        let menuView = (this.contentView as _HIMenuView);

        let viewport = HIWindow.visibleViewportFrame;
        let minX = viewport.x + _HIMenuWindowInset;
        let minY = viewport.y + _HIMenuWindowInset;
        let maxX = viewport.x + viewport.width - _HIMenuWindowInset;
        let maxY = viewport.y + viewport.height - _HIMenuWindowInset;

        let {x, y} = rect;
        let itemOffset = null as Nullable<HIPoint>;
        let {width, height} = _HIWithFreeSizeOfDOM(menuView.dom, size => {
            size.width = Math.max(size.width, minWidth);

            if (itemIndex !== -1) {
                itemOffset = menuView.offsetOfItemAt(itemIndex);
            }

            return size;
        });

        width = Math.min(Math.ceil(width), maxX - minX);
        height = Math.min(Math.ceil(height), maxY - minY);

        if (itemOffset !== null) {
            x -= itemOffset.x;
            y -= itemOffset.y;

        } else {
            //  Align the left edges. If the menu gets out of the screen, align the right edges.
            if (x + width > maxX) {x = rect.x + rect.width - width;}

            //  Place the menu below the rect. If the menu gets out, place it above.
            y += rect.height;
            if (y + height > maxY) {y = rect.y - height;}
        }

        if (x < minX) {x = minX;}
        else if (x + width > maxX) {x = maxX - width;}

        if (y < minY) {y = minY;}
        else if (y + height > maxY) {y = maxY - height;}

        this.contentView = menuView;
        this.frame = {x, y, width, height};
        this.makeKeyAndOrderFront();

        //  Scroll to the item if necessary.
        if (itemOffset !== null) {
            menuView.originOutset = {x: 0, y: y + itemOffset.y - rect.y};
        }
    }

    protected override closingAnimator(): Nullable<HIAnimator> {
        let menuView = this.contentView as _HIMenuView;

        let fadeDuration = 200;
        let popUp = menuView.popUpButtonAnimationData;

        if (popUp === null) {
            return HIAnimator.frameByFrame(fadeDuration, animator => {
                let opacity = 1 - animator.value;
                (this as any as HIWindowSPI)._frameView.frameDOM.style.opacity = opacity.toString();
            }).thenOrCatch(() => {
                (this as any as HIWindowSPI)._frameView.frameDOM.style.opacity = "1";
            });

        } else {
            let {x: oldX, y: oldY} = this.frame;
            let itemOffsetY = menuView.offsetOfItemAt(popUp.index).y;
            let oldItemScreenY = oldY - menuView.originOutset.y + itemOffsetY;
            let newItemScreenY = popUp.rect.y;

            let frameInterpolation = new HIRectInterpolation(this.frame, popUp.rect);

            return HIAnimator.frameByFrame(fadeDuration, animator => {
                let x = animator.value;
                let rect = _HIAlignScanRect(frameInterpolation.rectAt(x));
                let itemScreenY = _HIAlignScanCoord(oldItemScreenY + (newItemScreenY - oldItemScreenY) * x);
                this.frame = rect;
                menuView.originOutset = {x: rect.x - oldX, y: rect.y + itemOffsetY - itemScreenY};
            }).thenOrCatch(() => {
                menuView.originOutset = {x: 0, y: 0};
            });
        }
    }

    public override get wantsModalWhenKey(): boolean {
        return true;
    }

    public override modalMouseDownOutsideWindow(event: HIEvent<MouseEvent>): void {
        let menuView = (this.contentView as _HIMenuView);
        menuView.closeAnimated(true);
    }

    public override becomeKeyWindow(): void {
        this._savedKeyWindow = HIWindow.keyWindow;
        super.becomeKeyWindow();

        if (this._savedKeyWindow !== null) {
            let isMain = this._savedKeyWindow.isMainWindow;
            (this._savedKeyWindow as any as HIWindowSPI)._frameView.setKeyOrMainAppearance(true, isMain);
        }
    }

    public override resignKeyWindow(): void {
        super.resignKeyWindow();

        if (this._savedKeyWindow !== null) {
            let isKey = this._savedKeyWindow.isKeyWindow;
            let isMain = this._savedKeyWindow.isMainWindow;
            (this._savedKeyWindow as any as HIWindowSPI)._frameView.setKeyOrMainAppearance(isKey, isMain);
            this._savedKeyWindow = null;
        }
    }
}


const _HIMenuWindowInset: number = 6;
const _HIMenuItemCellInset: number = 21;


class _HIMenuItemCell {

    public readonly dom: HTMLElement;
    private _titleDOM: HTMLElement;
    private _imageDOM: Nullable<HTMLElement>;
    private _stateImageDOM: Nullable<HTMLElement>;

    public constructor() {
        this.dom = document.createElement("div");
        this.dom.classList.add("hi-menu-item-cell");

        this._titleDOM = document.createElement("span");
        this._titleDOM.classList.add("hi-menu-item-title");
        this.dom.appendChild(this._titleDOM);

        this._imageDOM = null;
        this._stateImageDOM = null;
    }

    public update(item: HIMenuItem) {
        let key = (item as any)._changedKey as Nullable<keyof HIMenuItem>;
        switch (key) {
        case "title":
            this.setTitle(item.title);
            break;
        case "image":
            this.setImage(item.image);
            break;
        case "state":
            this.setState(item.state, item.imageFor(item.state));
            break;
        case "isEnabled":
            this.setEnabled(item.isEnabled);
            break;
        case null:
            this.setTitle(item.title);
            this.setImage(item.image);
            this.setState(item.state, item.imageFor(item.state));
            this.setEnabled(item.isEnabled);
            break;
        }
    }

    public setTitle(title: string): void {
        this._titleDOM.textContent = title;
    }

    public setImage(image: Nullable<HIImage>): void {
        if (image === null) {
            if (this._imageDOM !== null) {
                this.dom.removeChild(this._imageDOM);
                this._imageDOM = null;
            }

        } else {
            let newDOM = image.makeDOM();
            newDOM.classList.add("hi-menu-item-image");
            this._imageDOM === null
                ? this._titleDOM.before(newDOM)
                : this._imageDOM.replaceWith(newDOM);
            this._imageDOM = newDOM;
        }
    }

    public setState(state: HIControlState, image: Nullable<HIImage>): void {
        HISetDOMState(this.dom, state);

        if (image === null) {
            if (this._stateImageDOM !== null) {
                this.dom.removeChild(this._stateImageDOM);
                this._stateImageDOM = null;
            }

        } else {
            let newDOM = image.makeDOM();
            newDOM.classList.add("hi-menu-state-image");
            this._stateImageDOM === null
                ? this.dom.prepend(newDOM)
                : this._stateImageDOM.replaceWith(newDOM);
            this._stateImageDOM = newDOM;
        }
    }

    public setHighlighted(isHighlighted: boolean): void {
        HISetDOMHasAttribute(this.dom, "highlighted", isHighlighted);
    }

    public setEnabled(isEnabled: boolean): void {
        HISetDOMHasAttribute(this.dom, "disabled", !isEnabled);
    }
}


const HIPopUpTopArrowSVG = `<svg viewBox="0 0 16 19" class="hi-menu-button-cap-arrow-glyph top" xmlns="http://www.w3.org/2000/svg"><path d="M5.15 7.35l3.1-3.1 3.1 3.05" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" fill="none"/></svg>`;
const HIPopUpBottomArrowSVG = `<svg viewBox="0 0 16 19" class="hi-menu-button-cap-arrow-glyph bottom" xmlns="http://www.w3.org/2000/svg"><path d="M5.15 11.65l3.1 3.1 3.1-3.1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" fill="none"/></svg>`;
