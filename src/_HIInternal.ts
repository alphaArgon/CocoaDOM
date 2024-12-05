/*
 *  _HIInternal.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/9/9.
 *  Copyright © 2024 alphaArgon.
 */

import type { _HIThemeFrame } from "./_HIThemeFrame.js";
import type { HIAppearance } from "./HIAppearance.js";
import type { HIColor } from "./HIColor.js";
import type { HIPopUpButton } from "./HIPopUpButton.js";
import type { HIEvent, HIResponder, HISelector } from "./HIResponder.js";
import type { HIView } from "./HIView.js";
import type { HIViewController } from "./HIViewController.js";
import type { HIWindow } from "./HIWindow.js";


export const enum _HIEventQuickTypeMask {
    mouseClicking   = 1 << 1,
    scrollWheel     = 1 << 2,
    keyPress        = 1 << 3,
    maskAll         = 0b1110,
}

export const _HIEventQuickTypeMaskSelectors: [_HIEventQuickTypeMask, ...(HISelector<HIResponder>)[]][] = [
    [_HIEventQuickTypeMask.mouseClicking,
        "mouseDown", "mouseDragged", "mouseUp",
        "rightMouseDown", "rightMouseDragged", "rightMouseUp",
        "otherMouseDown", "otherMouseDragged", "otherMouseUp"],
    [_HIEventQuickTypeMask.scrollWheel, "scrollWheel"],
    [_HIEventQuickTypeMask.keyPress, "keyDown", "keyUp"],
];

export type _HIResponderMetadata = {eventOverrides: _HIEventQuickTypeMask};
export const _HIResponderMetadataKey = Symbol("classMetadata");


export const enum _HIWindowState {
    orderedOut, orderingIn, orderedIn, orderingOut,
}


export interface HIViewSPI {

    _subviews: HIView[];

    _delegate: Nullable<HIViewController>;
    _setDelegate(delegate: Nullable<HIViewController>): void;

    _setWindow(window: Nullable<HIWindow>): void;
    _setWindowContent(flag: boolean): void;

    get _nextResponderIgnoringDelegate(): Nullable<HIResponder>;

    _windowWillAppear(): void;
    _windowDidAppear(): void;
    _windowWillDisappear(): void;
    _windowDidDisappear(): void;

    _didChangeInheritedAppearance(appearance: HIAppearance): void;
}


export interface HIWindowSPI {

    _frameView: _HIThemeFrame;

    _state: _HIWindowState;

    _viewDOMMouseDown(view: HIView, event: MouseEvent): void;
    _claimMouseSession(view: HIView, fromWindow: Nullable<HIWindow>): boolean
    _performDrag(event: HIEvent<MouseEvent>, type: number): void;

    _updateFocusRing(animated: boolean): void;

    _setViewTreeNeedsLayout(): void;
    _setViewTreeNeedsDisplay(): void;
}


export interface HIAppearanceSPI {

    readonly _accentColor: Nullable<HIColor>;
}


export interface HITrackingAreaSPI {

    _setOwner(owner: Nullable<HIView>): void;
}


export interface HIMenuSPI {

    _popUpPopUpButton(popUpButton: HIPopUpButton): void;
}
