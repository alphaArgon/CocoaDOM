/*
 *  _HITitleBarView.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/18.
 *  Copyright © 2024 alphaArgon.
 */

import { HIView } from "./HIView.js";
import { HIColor } from "./HIColor.js";
import { HIAppearance } from "./HIAppearance.js";
import type { HIEvent } from "./HIResponder.js";
import type { HIAppearanceSPI } from "./_HIInternal.js";


export class _HITitleBarView extends HIView {

    public readonly widgetButtons: Nullable<_HIWidgetButtons>;
    private _contentDOM: HTMLElement;
    private _titleDOM: HTMLElement;

    public constructor() {
        super();

        this._contentDOM = document.createElement("div");
        this._contentDOM.classList.add("hi-window-title-bar-content");
        this.dom.appendChild(this._contentDOM);

        this._titleDOM = document.createElement("span");
        this._titleDOM.classList.add("hi-window-title");
        this._contentDOM.appendChild(this._titleDOM);
        this._contentDOM.style.height = `${this.height}px`;

        this.widgetButtons = null;
    }

    public static override makeDOM(): HTMLElement {
        let dom = document.createElement("header");
        dom.classList.add("hi-window-title-bar");
        let background = document.createElement("div");
        background.classList.add("hi-window-title-bar-background");
        dom.appendChild(background);
        return dom;
    }

    public get height(): number {
        return 22;  //  Currently fixed. Toolbars are not implemented yet.
    }

    public setTitle(title: string): void {
        this._titleDOM.textContent = title;
    }

    public setTitleVisible(flag: boolean): void {
        this._titleDOM.style.display = flag ? "" : "none";
    }

    public setHasWidgetButtons(flag: boolean): void {
        if (!flag) {
            if (this.widgetButtons !== null) {
                this.widgetButtons.removeFromSuperview();
            }
            this._contentDOM.classList.remove("has-widget-buttons");

        } else {
            if (this.widgetButtons === null) {
                (this as any).widgetButtons = new _HIWidgetButtons();
            }
            this.addSubview(this.widgetButtons!);
            this._contentDOM.classList.add("has-widget-buttons");
        }

    }

    public override insertDOMOfProposedSubview(subview: HIView, proposedIndex: number): void {
        switch (subview) {
        case this.widgetButtons:
            this._contentDOM.prepend(subview.dom); break;
        default:
            throw new Error("Unknown subview inserted into _HITitleBarView");
        }
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return true;
    }

    //  This is not necessary. The superview — an _HIThemeFrame — overrides mouseDown and performs
    //  window dragging the mouse is not down on a resizer.
    //
    //  public override mouseDown(event: HIEvent<MouseEvent>): void {
    //    this.window!.performDrag(event);
    //  }
}


export const enum _HIWidgetButton {
    close, miniaturize, zoom,
}


/** The window control buttons.
  * 
  * For convenience, the three buttons are implemented as a single view, which is not consistent
  * with that in AppKit. */
class _HIWidgetButtons extends HIView {

    private _mouseDownButton: Nullable<_HIWidgetButton> = null;

    public static override makeDOM(): HTMLElement {
        let dom = document.createElement("span");
        dom.classList.add("hi-window-widget-buttons");

        let closeButton = document.createElement("button");
        closeButton.classList.add("hi-window-widget-button", "close");
        dom.appendChild(closeButton);

        let miniaturizeButton = document.createElement("button");
        miniaturizeButton.classList.add("hi-window-widget-button", "miniaturize");
        dom.appendChild(miniaturizeButton);

        let zoomButton = document.createElement("button");
        zoomButton.classList.add("hi-window-widget-button", "zoom");
        dom.appendChild(zoomButton);

        return dom;
    }

    public setEnabledOfButton(button: _HIWidgetButton, enabled: boolean): void {
        (this.dom.children[button] as HTMLButtonElement).disabled = !enabled;
    }

    public hitTestButton(event: HIEvent<MouseEvent>): Nullable<_HIWidgetButton> {
        let button = Array.prototype.indexOf.call(this.dom.children, event.native.target);
        if (button === -1) {return null;}
        return button;
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return true;
    }

    public override shouldDelayWindowOrdering(event: HIEvent<MouseEvent>): boolean {
        let button = this.hitTestButton(event);
        return button === _HIWidgetButton.close || button === _HIWidgetButton.miniaturize;
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        this._mouseDownButton = this.hitTestButton(event);
        if (this._mouseDownButton === null) {
            return super.mouseDown(event);
        }

        this.window!.preventOrdering();
        this.dom.classList.add("active");
        this.dom.children[this._mouseDownButton].classList.add("highlighted");
    }

    public override mouseDragged(event: HIEvent<MouseEvent>): void {
        if (this._mouseDownButton === null) {
            return super.mouseDragged(event);
        }

        let stillOn = event.isMouseInDOM(this.dom.children[this._mouseDownButton]);
        this.dom.children[this._mouseDownButton].classList.toggle("highlighted", stillOn);
    }

    public override mouseUp(event: HIEvent<MouseEvent>): void {
        if (this._mouseDownButton === null) {
            return super.mouseUp(event);
        }

        let stillOn = event.isMouseInDOM(this.dom.children[this._mouseDownButton]);

        if (stillOn)
        switch (this._mouseDownButton) {
            case 0: this.window!.orderOut(this); break;
            case 1: break;  //  TODO: Miniaturize
            case 2: break;  //  TODO: Zoom
        }

        this.dom.classList.remove("active");
        this.dom.children[this._mouseDownButton].classList.remove("highlighted");
    }
}

{
    HIAppearance.addCSSVariableProvider("--hi-title-bar-background", appearance => {
        return appearance.isDark ? "#2d2d2d" : "#f6f6f6";
    });

    HIAppearance.addCSSVariableProvider("--hi-active-title-bar-background", appearance => {
        return appearance.isDark
            ? "linear-gradient(rgba(70, 70, 70, 0.8), rgba(55, 55, 55, 0.8))"
            : "linear-gradient(rgba(236, 236, 236, 0.8), rgba(210, 210, 210, 0.8))";
    });

    HIAppearance.addCSSVariableProvider("--hi-title-bar-shadow", appearance => {
        return appearance.isDark
            ? "inset rgba(0, 0, 0, 0.8) 0 -1px"
            : "inset rgba(0, 0, 0, 0.1) 0 -1px";
    });

    HIAppearance.addCSSVariableProvider("--hi-active-title-bar-shadow", appearance => {
        return appearance.isDark
            ? "inset rgba(0, 0, 0, 0.8) 0 -1px,"
            + "inset rgba(255, 255, 255, 1) 0 1px 1px -1px"
            : "inset rgba(0, 0, 0, 0.75) 0 -1px 1px -1px,"
            + "inset rgba(255, 255, 255, 1) 0 1px 1px -1px,"
            + "inset rgba(255, 255, 255, 0.15) 0 1px";
    });

    HIAppearance.addCSSVariableProvider("--hi-widget-button-base-x", appearance => {
        let isGraphite = (appearance as any as HIAppearanceSPI)._accentColor === HIColor.systemGray;
        let isDark = appearance.isDark;
        return (+isDark * 2 + +isGraphite * 1) * (16 * -6) + "px";
    });
}
