/*
 *  HITrackingArea.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/23.
 *  Copyright © 2024 alphaArgon.
 */

import { HIEvent, HIEventType, HIResponder, HISelector } from "./HIResponder.js";
import type { HIView } from "./HIView.js";


export const enum HITrackingAreaOptions {
    mouseEnteredAndExited = 1 << 0,
    mouseMoved = 1 << 1,
}


export class HITrackingArea {

    private _dom: HTMLElement;
    private _options: HITrackingAreaOptions;
    private _owner: Nullable<HIView>;

    public constructor(dom: HTMLElement, options: HITrackingAreaOptions) {
        this._dom = dom;
        this._options = options;
        this._owner = null;
    }

    public get owner(): Nullable<HIView> {
        return this._owner;
    }

    /** @internal SPI to `HIView`. */
    private _setOwner(owner: Nullable<HIView>): void {
        if (this._owner === owner) {return;}

        if (this._owner !== null) {
            this._stopTracking();
        }

        this._owner = owner;

        if (this._owner !== null) {
            this._startTracking();
        }
    }

    private _startTracking(): void {
        if (this._options & HITrackingAreaOptions.mouseEnteredAndExited) {
            this._dom.addEventListener("mouseenter", this);
            this._dom.addEventListener("mouseleave", this);
        }

        if (this._options & HITrackingAreaOptions.mouseMoved) {
            this._dom.addEventListener("mousemove", this);
        }
    }

    private _stopTracking(): void {
        if (this._options & HITrackingAreaOptions.mouseEnteredAndExited) {
            this._dom.removeEventListener("mouseenter", this);
            this._dom.removeEventListener("mouseleave", this);
        }

        if (this._options & HITrackingAreaOptions.mouseMoved) {
            this._dom.removeEventListener("mousemove", this);
        }
    }

    /** @private */
    public handleEvent(nativeEvent: MouseEvent): void {
        if (this._owner === null) {return;}

        let event: HIEvent<MouseEvent>;
        let selecor: HISelector<HIResponder>;

        switch (nativeEvent.type) {
        case "mouseenter":
            event = new HIEvent(HIEventType.mouseEntered, nativeEvent);
            selecor = "mouseEntered"; break;
        case "mouseleave":
            event = new HIEvent(HIEventType.mouseExited, nativeEvent);
            selecor = "mouseExited"; break;
        case "mousemove":
            event = new HIEvent(HIEventType.mouseMoved, nativeEvent);
            selecor = "mouseMoved"; break;
        default: return;
        }

        HIEvent.push(event);
        (this._owner as any)[selecor](event);
        HIEvent.pop(event);
    }
}
