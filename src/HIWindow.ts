/*
 *  HIWindow.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/9/9.
 *  Copyright © 2024 alphaArgon.
 */

import { HIEvent, HIEventType, HIResponder, HISelector } from "./HIResponder.js";
import { HIPoint, HIRect, HISize, HIView } from "./HIView.js";
import { HIAppearance } from "./HIAppearance.js";
import { HIAnimator } from "./HIAnimator.js";
import { HINotificationCenter, HINotificationName } from "./HINotification.js";
import { HIWindowStyleMask, _HIWindowDragType, _HIThemeFrame } from "./_HIThemeFrame.js";
import { HIBFSTraversal, HIGetReadonlyProxy, HISavedGetter } from "./_HIUtils.js";
import { _HIResizingCursor, _HIWindowDragFrame, _HIWindowFixFrame } from "./_HIWindowDragging.js";
import { _HIWindowState, HIViewSPI } from "./_HIInternal.js";
import type { HIColor } from "./HIColor.js";
import type { HIViewController } from "./HIViewController.js";


export { HIWindowStyleMask };
export const enum HIWindowLevel {
    normal      = 0,
    sheet       = 5,
    floating    = 10,
    popUpMenu   = 20,
    cursor      = 100,
}


/** A shared layer for all windows, which is used to show the specific cursor when dragging. */
let _HIDraggingOverlayDOM: Nullable<HTMLElement> = null;
let _HIDraggingOverlayShown: boolean = false;
let _HIDraggingOverlayCursor: string = "";

function _HIShowDraggingOverlay(cursor: string): void {
    if (!_HIDraggingOverlayShown) {
        if (_HIDraggingOverlayDOM === null) {
            _HIDraggingOverlayDOM = document.createElement("div");
            _HIDraggingOverlayDOM.classList.add("hi-window-dragging-overlay");
            document.body.appendChild(_HIDraggingOverlayDOM);
        } else {
            _HIDraggingOverlayDOM.hidden = false;
        }

        _HIDraggingOverlayShown = true;
    }

    if (cursor !== _HIDraggingOverlayCursor) {
        _HIDraggingOverlayCursor = cursor;
        _HIDraggingOverlayDOM!.style.cursor = cursor;
    }
}

function _HIHideDraggingOverlay(): void {
    if (_HIDraggingOverlayShown) {
        _HIDraggingOverlayDOM!.hidden = true;
        _HIDraggingOverlayDOM!.removeAttribute("style");
        _HIDraggingOverlayCursor = "";
        _HIDraggingOverlayShown = false;
    }
}


let _HIMainWindow: Nullable<HIWindow> = null;
let _HIKeyWindow: Nullable<HIWindow> = null;
let _HIWindowIsCheckingKeyDOMFocus: boolean = false;


/** A `HIWindow` is not related to BOM’s `window`, nor is a subclass of `HIView`. It manages its
  * content view, and handles event dispatching. */
export class HIWindow extends HIResponder {

    public static readonly didBecomeKeyNotification: HINotificationName<void> = "HIWindowDidBecomeKeyNotification";
    public static readonly didResignKeyNotification: HINotificationName<void> = "HIWindowDidResignKeyNotification";
    public static readonly didBecomeMainNotification: HINotificationName<void> = "HIWindowDidBecomeMainNotification";
    public static readonly didResignMainNotification: HINotificationName<void> = "HIWindowDidResignMainNotification";

    private readonly _frameView: _HIThemeFrame;
    private _contentViewController: Nullable<HIViewController>;

    //  If the window is ordered in, all its ancestors and descendants are ordered in.
    //  For a top-level window, it’s ordered in iff its parent is the pseudo root.
    private _parent: Nullable<HIWindow>;
    private readonly _children: HIWindow[];

    /** If the window is not ordered in (i.e. not connected to the document), this value is
      * `orderedOut`; otherwise it must be in `orderingIn`, `orderedIn`, or `orderingOut`. */
    private _state: _HIWindowState;
    private _orderingAnimator: Nullable<HIAnimator>;

    private _firstResponder: this | HIView;

    private readonly _focusRingDOM: HTMLElement;
    private _focusRingTimer: number;

    private _mouseSession: Nullable<{
        dragsWindow: false,
        view: HIView,
        orderFrontWhenUp: boolean,
    } | {
        dragsWindow: true,
        downAt: HIPoint,
        original: HIRect,
        type: _HIWindowDragType,
        hitThreshold: boolean,
        symmetric: boolean,
        onceMoved: boolean,
    }>;

    private _cancelsNextNativeMenu: boolean;

    private _delayedCheckKeyDOMFocus: number;

    private _viewTreeNeedsLayout: boolean;
    private _queuedViewTreeLayout: boolean;

    private _viewTreeNeedsDisplay: boolean;
    private _delayedViewTreeDisplay: number;

    public constructor() {
        super();

        this._frameView = new _HIThemeFrame();
        (this._frameView as any as HIViewSPI)._setWindow(this);

        this._contentViewController = null;

        this._parent = null;
        this._children = [];
        this._state = _HIWindowState.orderedOut;
        this._orderingAnimator = null;

        this._firstResponder = this;
        this._mouseSession = null;
        this._cancelsNextNativeMenu = false;

        this._delayedCheckKeyDOMFocus = 0;

        this._focusRingDOM = document.createElement("div");
        this._focusRingDOM.classList.add("hi-focus-ring");
        this._frameView.frameDOM.appendChild(this._focusRingDOM);

        this._focusRingTimer = 0;

        this._viewTreeNeedsLayout = false;
        this._queuedViewTreeLayout = false;

        this._viewTreeNeedsDisplay = false;
        this._delayedViewTreeDisplay = 0;
    }

    /** A stub for convenience of window management. It’s not a real window, but a container for all
     * top-level windows. */
    @HISavedGetter
    private static get _pseudoRoot(): HIWindow {
        let window = Object.create(HIWindow.prototype) as HIWindow;
        (window as any)._frameView = _HIThemeFrame.pseudoRoot;
        (window as any)._children = [];
        window._state = _HIWindowState.orderedIn;

        let focusOneChanged = false;
    
        document.addEventListener("keydown", () => {
            if (focusOneChanged && _HIKeyWindow !== null) {
                (_HIKeyWindow as any)._checkKeyDOMFocus();
                focusOneChanged = false;
            }
        }, true);

        document.addEventListener("blur", () => {
            if (_HIWindowIsCheckingKeyDOMFocus) {return;}
            focusOneChanged = true;
        }, true);

        return window;
    }

    /** Returns the frame of the viewport. */
    public static get viewportFrame(): HIRect {
        return {x: 0, y: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight};
    }

    public static get visibleViewportFrame(): HIRect {
        return {x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight};
    }

    /** Returns all top-level windows. */
    public static get windows(): readonly HIWindow[] {
        return HIGetReadonlyProxy(HIWindow._pseudoRoot._children);
    }

    public static get mainWindow(): Nullable<HIWindow> {
        return _HIMainWindow;
    }

    public static get keyWindow(): Nullable<HIWindow> {
        return _HIKeyWindow;
    }

    public get contentView(): HIView {
        if (this._frameView.contentView === null) {
            this._frameView.setContentView(new HIView());
        }
        return this._frameView.contentView!;
    }

    public set contentView(view: HIView) {
        if (this._contentViewController !== null) {
            throw new Error("Cannot set content view when content view controller is set.");
        }
        this._frameView.setContentView(view);
    }

    public get contentViewController(): Nullable<HIViewController> {
        return this._contentViewController;
    }

    public set contentViewController(viewController: Nullable<HIViewController>) {
        if (this._contentViewController === viewController) {return;}
        this._contentViewController = viewController;
        if (viewController !== null) {
            this._frameView.setContentView(viewController.view);
        }
    }

    public get frame(): HIRect {
        return this._frameView.frame;
    }

    public set frame(frame: HIRect) {
        this._frameView.setFrame(frame);
    }

    public get level(): HIWindowLevel | number {
        return this._frameView.level;
    }

    public set level(level: HIWindowLevel | number) {
        this._frameView.setLevel(level);
    }

    public get styleMask(): HIWindowStyleMask {
        return this._frameView.styleMask;
    }

    public set styleMask(styleMask: HIWindowStyleMask) {
        this._frameView.setStyleMask(styleMask);
    }

    public get backgroundColor(): HIColor {
        return this._frameView.backgroundColor;
    }

    public set backgroundColor(color: HIColor) {
        this._frameView.setBackgroundColor(color);
    }

    public get title(): string {
        return this._frameView.title;
    }

    public set title(title: string) {
        this._frameView.setTitle(title);
    }

    public get minSize(): HISize {
        return this._frameView.minSize;
    }

    public set minSize(size: HISize) {
        this._frameView.setMinSize(size);
    }

    public get maxSize(): HISize {
        return this._frameView.maxSize;
    }

    public set maxSize(size: HISize) {
        this._frameView.setMaxSize(size);
    }

    public get appearance(): Nullable<HIAppearance> {
        return this._frameView.appearance;
    }

    public set appearance(appearance: Nullable<HIAppearance>) {
        this._frameView.appearance = appearance;
    }

    public get effectiveAppearance(): HIAppearance {
        return this._frameView.effectiveAppearance;
    }

    /** @private */
    public systemAppearanceDidChange(notification: HINotificationName<void>): void {
        (this._frameView as any as HIViewSPI)._didChangeInheritedAppearance(HIAppearance.system);
    }

    /** @internal SPI to `_HIWindowFrameView`. */
    private _performDrag(event: HIEvent<MouseEvent>, type: _HIWindowDragType): void {
        if (this._mouseSession === null) {return;}
        if (this._mouseSession.dragsWindow) {return;}
        if (event.native.buttons !== 1) {return;}
        this._mouseSession = {
            dragsWindow: true,
            downAt: {x: event.native.clientX, y: event.native.clientY},
            original: this._frameView.frame.copy(),
            type: type,
            hitThreshold: false,
            symmetric: event.native.altKey,
            onceMoved: false,
        };
    }

    /** Starts a window drag based on the specified mouse-down event. */
    public performDrag(event: HIEvent<MouseEvent>): void {
        this._performDrag(event, _HIWindowDragType.move);
    }

    /** Sets the cursor during mouse down period. The cursor will be automatically reset after mouse
      * up. If the the mouse is not pressed, nothing will happen.
      * 
      * Note that if the cursor is set, an overlay will be shown to optimize performance, and thus
      * target DOMs of dragging events will be the overlay, not the original target. */
    public setDraggingCursor(cursor: string): void {
        if (this._mouseSession === null) {return;}
        _HIShowDraggingOverlay(cursor);
    }

    /** Suppresses the usual window ordering in handling the most recent mouse-down event. */
    public preventOrdering(): void {
        if (this._mouseSession === null) {return;}
        if (this._mouseSession.dragsWindow) {return;}
        this._mouseSession.orderFrontWhenUp = false;
    }

    public get isInLiveResize(): boolean {
        return this._mouseSession !== null && this._mouseSession.dragsWindow;
    }

    /** @internal SPI to `HIView`. */
    private _viewDOMMouseDown(view: HIView, nativeEvent: MouseEvent): void {
        if (this._state !== _HIWindowState.orderedIn) {return;}
        if (view.window !== this) {return;}

        if (this._mouseSession === null) {
            this._mouseSession = {dragsWindow: false, view, orderFrontWhenUp: false};

        } else if (!this._mouseSession.dragsWindow) {
            //  If the one is a descendant of the other, use that one.
            let old = this._mouseSession.view;
            switch (old.ancestorSharedWith(view)) {
            case old: this._mouseSession.view = view; break;
            case view: break;  //  No need to change.
            default:
                //  The new view is irrelevant to the current mouse session.
                //  AppKit seems to have a mouse session stack, but that works buggy.
                //  Here we simply discard this mouse down event.
                return;
            }

        } else {
            return;
        }

        let event: HIEvent<MouseEvent>;
        let selector: HISelector<HIResponder>;

        switch (nativeEvent.button) {
        case 0:
            event = new HIEvent(HIEventType.mouseDown, nativeEvent);
            selector = "mouseDown"; break;
        case 2:
            event = new HIEvent(HIEventType.rightMouseDown, nativeEvent);
            selector = "rightMouseDown"; break;
        default:
            event = new HIEvent(HIEventType.otherMouseDown, nativeEvent);
            selector = "otherMouseDown"; break;
        }

        HIEvent.push(event);

        if (this !== _HIKeyWindow && nativeEvent.button === 0) {
            //  `suppressesOtherFirstMouse` is an SPI of `_HIMenuWindow`.
            let suppressFirstMouse = (_HIKeyWindow as any)?.suppressesOtherFirstMouse === true;

            if (!event.isMetaKeyDown) {
                if (view.shouldDelayWindowOrdering(event)) {
                    this._mouseSession.orderFrontWhenUp = true;
                } else {
                    this.makeKeyAndOrderFront();
                }
            }

            suppressFirstMouse ||= view.needsPanelToBecomeKey || !view.acceptsFirstMouse(event);
            if (suppressFirstMouse) {
                HIEvent.pop(event);
                this._mouseSession = null;
                return;
            }
        }

        if (this._firstResponder !== view && view.needsPanelToBecomeKey) {
            this.makeFirstResponder(view);
        }

        (view as any)[selector](event);
        HIEvent.pop(event);

        this._setCancelsNextNativeMenu(!event.allowsNativeDefault);

        if (event.allowsNativeDefault) {
            //  The focus might be lost after the mouse down event.
            this._checkKeyDOMFocus();

        } else if (this._delayedCheckKeyDOMFocus === 0) {
            this._delayedCheckKeyDOMFocus = setTimeout(() => {
                this._delayedCheckKeyDOMFocus = 0;
                this._checkKeyDOMFocus();
            });
        }

        //  These two listeners are added to `document` because even if the mouse is outside the
        //  view, the dragging should still be handled.
        //  Events are listened in the capturing phase to optimize performance. `mousemove` and
        //  `mouseup` would not have default actions.
        document.addEventListener("mousemove", this, true);
        document.addEventListener("mouseup", this, true);
    }

    /** Syncs the mouse scene with the view in another window.
      *
      * @internal SPI to `_HIMenuView`. */
    private _claimMouseSession(view: HIView, fromWindow: Nullable<HIWindow>): boolean {
        if (this._mouseSession !== null) {return false;}
        if (this._state !== _HIWindowState.orderedIn) {return false;}
        if (view.window !== this) {return false;}

        if (fromWindow === null) {
            let event = HIEvent.current as Nullable<HIEvent<MouseEvent>>;
            if (event === null || event.native.type !== "mousedown") {return false;}
            this._mouseSession = {dragsWindow: false, view, orderFrontWhenUp: false};
        } else {
            if (fromWindow._mouseSession === null) {return false;}
            if (fromWindow._mouseSession.dragsWindow) {return false;}
            this._mouseSession = fromWindow._mouseSession;
            this._mouseSession.view = view;
        }

        document.addEventListener("mousemove", this, true);
        document.addEventListener("mouseup", this, true);
        return true;
    }

    private _discardMouseSession(): void {
        this._mouseSession = null;
        document.removeEventListener("mousemove", this, true);
        document.removeEventListener("mouseup", this, true);

        _HIHideDraggingOverlay();
    }

    /** @private */
    public handleEvent(event: Event): void {
        switch (event.type) {
        case "mousemove": return this._handleDOMMouseMove(event as MouseEvent);
        case "mouseup": return this._handleDOMMouseUp(event as MouseEvent);
        case "contextmenu": return this._handleDOMContextMenu(event as MouseEvent);
        }
    }

    private _setCancelsNextNativeMenu(cancels: boolean): void {
        if (cancels === this._cancelsNextNativeMenu) {return;}
        this._cancelsNextNativeMenu = cancels;
        cancels
            ? document.addEventListener("contextmenu", this)
            : document.removeEventListener("contextmenu", this);
    }

    private _handleDOMMouseMove(nativeEvent: MouseEvent): void {
        this._setCancelsNextNativeMenu(false);

        if (this._mouseSession === null) {
            return this._discardMouseSession();
        }

        if ((nativeEvent.movementX | nativeEvent.movementY) === 0) {return;}

        if (!this._mouseSession.dragsWindow) {
            if (nativeEvent.buttons === 0) {
                //  The mouse up event is missed/cancelled.
                return this._discardMouseSession();
            }

            if (this._mouseSession.view.window !== this) {
                //  The view is removed from the window during the mouse scene.
                return this._discardMouseSession();
            }

            let event: HIEvent<MouseEvent>;
            let selector: HISelector<HIResponder>;

            switch (true) {
            case (nativeEvent.buttons & 1) !== 0:
                event = new HIEvent(HIEventType.mouseDragged, nativeEvent);
                selector = "mouseDragged"; break;
            case (nativeEvent.buttons & 2) !== 0:
                event = new HIEvent(HIEventType.rightMouseDragged, nativeEvent);
                selector = "rightMouseDragged"; break;
            default:
                event = new HIEvent(HIEventType.otherMouseDragged, nativeEvent);
                selector = "otherMouseDragged"; break;
            }

            HIEvent.push(event);
            (this._mouseSession.view as any)[selector](event);
            HIEvent.pop(event);

        } else {
            if (nativeEvent.buttons === 0) {
                //  We still need to handle the mouse up event for window dragging.
                return this._handleDOMMouseUp(nativeEvent);
            }

            let symmetric = nativeEvent.altKey;
            if (symmetric !== this._mouseSession.symmetric) {
                this._mouseSession.downAt = {x: nativeEvent.clientX, y: nativeEvent.clientY};
                this._mouseSession.original = this._frameView.frame.copy();
                this._mouseSession.symmetric = symmetric;
                return;
            }

            const ε = 4;

            let dx = nativeEvent.clientX - this._mouseSession.downAt.x;
            let dy = nativeEvent.clientY - this._mouseSession.downAt.y;

            if (this._mouseSession.type !== _HIWindowDragType.move
             && !this._mouseSession.hitThreshold) {
                //  If deltas are too small, ignore the dragging.
                //  If the direction of dragging and allowed resizing are not consistent,
                //  the resizing decays to moving.

                let absX = Math.abs(dx);
                let absY = Math.abs(dy);

                switch (this._mouseSession.type) {
                case _HIWindowDragType.resizeN:
                case _HIWindowDragType.resizeS:
                    if (absX > ε && absY < ε) {this._mouseSession.type = _HIWindowDragType.move;} break;
                case _HIWindowDragType.resizeW:
                case _HIWindowDragType.resizeE:
                    if (absX < ε && absY > ε) {this._mouseSession.type = _HIWindowDragType.move;} break;
                }

                if (absX > ε || absY > ε) {
                    this._mouseSession.hitThreshold = true;
                } else {
                    let cursor = _HIResizingCursor(this._mouseSession.type);
                    _HIShowDraggingOverlay(cursor);
                    return;
                }
            }

            let frame = Object.assign({}, this._mouseSession.original);
            let cursor = _HIWindowDragFrame(frame, this._mouseSession.type, symmetric, dx, dy, ε);
            _HIWindowFixFrame(frame, this._mouseSession.type, symmetric, this._frameView.minSize, this._frameView.maxSize);
            _HIShowDraggingOverlay(cursor);
            this._frameView.setFrame(frame);
            this._mouseSession.onceMoved = true;
        }
    }

    private _handleDOMMouseUp(nativeEvent: MouseEvent): void {
        if (this._mouseSession === null) {
            return this._discardMouseSession();
        }

        if (!this._mouseSession.dragsWindow) {
            if (this._mouseSession.view.window === this) {
                let event: HIEvent<MouseEvent>;
                let selector: HISelector<HIResponder>;

                switch (nativeEvent.button) {
                case 0:
                    event = new HIEvent(HIEventType.mouseUp, nativeEvent);
                    selector = "mouseUp"; break;
                case 2:
                    event = new HIEvent(HIEventType.rightMouseUp, nativeEvent);
                    selector = "rightMouseUp"; break;
                default:
                    event = new HIEvent(HIEventType.otherMouseUp, nativeEvent);
                    selector = "otherMouseUp"; break;
                }

                HIEvent.push(event);
                (this._mouseSession.view as any)[selector](event);
                HIEvent.pop(event);

                this._setCancelsNextNativeMenu(!event.allowsNativeDefault);
            }

            if (this._mouseSession.orderFrontWhenUp) {
                this.makeKeyAndOrderFront();
            }

        } else if (this._mouseSession.onceMoved) {
            let {x, y, width, height} = this._frameView.frame;
            this._discardMouseSession();

            //  Doing so to update cursors of the resizers.
            this._frameView.setFrame({x, y, width, height});
        }

        if (nativeEvent.buttons === 0) {
            //  If menu is cancelled, the `contextmenu` will be dispatched after `mouseup`, so
            //  we can’t discard the mouse session — which removes the listeners — here.
            this._discardMouseSession();
        }
    }

    private _handleDOMContextMenu(nativeEvent: MouseEvent): void {
        nativeEvent.preventDefault();
        this._setCancelsNextNativeMenu(false);
    }

    public get isMainWindow(): boolean {
        return this === _HIMainWindow;
    }

    public get canBecomeMainWindow(): boolean {
        return (this._frameView.styleMask & (HIWindowStyleMask.titled | HIWindowStyleMask.resizable)) !== 0;
    }

    public makeMainWindow(): void {
        this.becomeMainWindow();
    }

    public becomeMainWindow(): void {
        if (this._state === _HIWindowState.orderedOut) {return;}
        if (this === _HIMainWindow) {return;}
        if (!this.canBecomeMainWindow) {return;}
        if (_HIMainWindow !== null) {
            _HIMainWindow.resignMainWindow();
        }

        _HIMainWindow = this;
        this._frameView.setKeyOrMainAppearance(this === _HIKeyWindow, true);
        HINotificationCenter.default.post(HIWindow.didBecomeMainNotification, this);
    }

    public resignMainWindow(): void {
        if (this !== _HIMainWindow) {return;}

        _HIMainWindow = null;
        this._frameView.setKeyOrMainAppearance(this === _HIKeyWindow, false);
        HINotificationCenter.default.post(HIWindow.didResignMainNotification, this);
    }

    public get isKeyWindow(): boolean {
        return this === _HIKeyWindow;
    }

    public makeKeyWindow(): void {
        this.becomeKeyWindow();
        this.becomeMainWindow();
    }

    public becomeKeyWindow(): void {
        if (this._state === _HIWindowState.orderedOut) {return;}
        if (this === _HIKeyWindow) {return;}
        if (_HIKeyWindow !== null) {
            _HIKeyWindow.resignKeyWindow();
        }

        _HIKeyWindow = this;
        this._frameView.setKeyOrMainAppearance(true, this === _HIMainWindow);
        this._checkKeyDOMFocus();
        HINotificationCenter.default.post(HIWindow.didBecomeKeyNotification, this);
    }

    public resignKeyWindow(): void {
        if (this !== _HIKeyWindow) {return;}

        _HIKeyWindow = null;
        this._frameView.setKeyOrMainAppearance(false, this === _HIMainWindow);

        _HIWindowIsCheckingKeyDOMFocus = true;
        document.body.focus();  //  Resets focus.
        _HIWindowIsCheckingKeyDOMFocus = false;

        HINotificationCenter.default.post(HIWindow.didResignKeyNotification, this);
    }

    private _resignMainAndMakeNextMainWindow(): void {
        this.resignMainWindow();
        if (_HIMainWindow !== null) {return;}

        let candidate = this._windowBeneath();
        while (candidate !== null) {
            candidate.becomeMainWindow();
            if (_HIMainWindow !== null) {return;}

            candidate = candidate._windowBeneath();
        }
    }

    private _resignKeyAndMakeNextKeyWindow(): void {
        this.resignKeyWindow();
        if (_HIKeyWindow !== null) {return;}

        let candidate = _HIMainWindow;
        if (candidate === null || candidate === this) {
            candidate = this._windowBeneath();
        }

        while (candidate !== null) {
            candidate.becomeKeyWindow();
            if (_HIKeyWindow !== null) {return;}

            candidate = candidate._windowBeneath();
        }
    }

    private _windowBeneath(): Nullable<HIWindow> {
        if (this._parent === null) {return null;}
        if (this._parent._state !== _HIWindowState.orderedIn) {return null;}

        let index = this._parent._children.indexOf(this);
        for (let i = index - 1; i >= 0; i -= 1) {
            let window = this._parent._children[i];
            if (window._state === _HIWindowState.orderedIn) {return window;}
        }

        return null;
    }

    public get isVisible(): boolean {
        return this._state !== _HIWindowState.orderedOut;
    }

    /** Sets the state, and calls the corresponding methods on the frame view.
      * 
      * The lifecycle of a window is:
      *   `orderedOut`  parent null
      *   `orderingIn`  parent set
      *   `orderedIn`   parent set
      *   `orderingOut` parent null
      * 
      * Typically the state should be set to its next state, but the special case is that the
      * window’s animation is interrupted, and the state can be set from `orderingIn` to
      * `orderingOut` if opening, or inversely if closing.
      * 
      * This method does’t check the validity of the state transition. */
    private _setState(state: _HIWindowState): void {
        this._state = state;
        switch (state) {
        case _HIWindowState.orderedOut:
            this._cancelDelayedViewTreeDisplay();
            (this._frameView as any as HIViewSPI)._windowDidDisappear();
            HINotificationCenter.default.removeObserver(this, HIAppearance.didChangeSystemAppearanceNotification);
            break;

        case _HIWindowState.orderingIn:
            this._triggerDelayedViewTreeLayoutIfNeeded();
            this._startDelayedViewTreeDisplayIfNeeded();
            (this._frameView as any as HIViewSPI)._windowWillAppear();
            HINotificationCenter.default.addObserver(this, "systemAppearanceDidChange", HIAppearance.didChangeSystemAppearanceNotification);
            (this._frameView as any as HIViewSPI)._didChangeInheritedAppearance(HIAppearance.system);
            break;

        case _HIWindowState.orderedIn:
            (this._frameView as any as HIViewSPI)._windowDidAppear();
            break;

        case _HIWindowState.orderingOut:
            (this._frameView as any as HIViewSPI)._windowWillDisappear();
            break;
        }
    }

    /** Make the window be a child of the given parent window. If the parent window is visible, the
      * window becomes ordered in. */
    private _attachToParent(parent: HIWindow): void {
        if (this._parent === parent) {
            //  Make the window the last child of the parent.
            let index = parent._children.indexOf(this);
            if (index !== parent._children.length - 1) {
                parent._children.splice(index, 1);
                parent._children.push(this);
                parent._frameView.dom.appendChild(this._frameView.dom);
            }
            return;            

        } else if (this._parent !== null) {
            this._detachFromParent();
        }

        this._parent = parent;
        parent._children.push(this);
        parent._frameView.dom.appendChild(this._frameView.dom);

        if (parent._state === _HIWindowState.orderedOut) {return;}

        {
            for (let window of HIBFSTraversal(this, "_children" as any)) {
                //  The window it self might be interrupted from `orderingOut` to order in.
                if (window._orderingAnimator !== null) {
                    window._orderingAnimator.cancel();
                    window._orderingAnimator = null;
                }
                if (window._state !== _HIWindowState.orderingIn) {
                    window._setState(_HIWindowState.orderingIn);
                }

                window._makeInitialFirstResponder();
            }
        }

        let then = () => {
            for (let window of HIBFSTraversal(this, "_children" as any)) {
                if (window._state !== _HIWindowState.orderedIn) {
                    window._setState(_HIWindowState.orderedIn);
                }
            }

            this._orderingAnimator = null;
        };

        this._orderingAnimator = this.openingAnimator();
        if (this._orderingAnimator === null) {then();}
        else {this._orderingAnimator.play().then(then);}
    }

    /** Detaches the window from its parent window. If the window has a closing animation, it will
      * remain visible until the animation is finished, leaving it parentless. */
    private _detachFromParent(): void {
        if (this._parent === null) {return;}

        let parent = this._parent;
        this._parent = null;

        let indexInParent = parent._children.indexOf(this);
        parent._children.splice(indexInParent, 1);

        if (parent._state === _HIWindowState.orderedOut) {
            this._frameView.dom.remove();
            return;
        }

        {
            for (let window of HIBFSTraversal(this, "_children" as any)) {
                if (window._orderingAnimator !== null) {
                    window._orderingAnimator.cancel();
                    window._orderingAnimator = null;
                }
                if (window._state !== _HIWindowState.orderingOut) {
                    window._setState(_HIWindowState.orderingOut);
                }

                window._resignMainAndMakeNextMainWindow();
                window._resignKeyAndMakeNextKeyWindow();
            }
        }

        let then = () => {
            for (let window of HIBFSTraversal(this, "_children" as any)) {
                if (window._state !== _HIWindowState.orderedOut) {
                    window._setState(_HIWindowState.orderedOut);
                }

                //  We still need to check these.
                window._resignMainAndMakeNextMainWindow();
                window._resignKeyAndMakeNextKeyWindow();
            }

            this._frameView.dom.remove();
            this._orderingAnimator = null;
        };

        this._orderingAnimator = this.closingAnimator();
        if (this._orderingAnimator === null) {then();}
        else {this._orderingAnimator.play().then(then);}
    }

    /** Returns an animator to play the opening animation, or `null` if the window doesn’t need an
      * opening animation.
      * 
      * This method is called when the DOM of the window is already attached to the document,
      * therefore the window is visible. 
      * 
      * Do not call this method directly, and do not change the window or view hierarchy in this
      * method. */
    protected openingAnimator(): Nullable<HIAnimator> {
        return null;
    }

    /** Returns an animator to play the closing animation, or `null` if the window doesn’t need a
      * closing animation.
      * 
      * This method is called when the DOM of the window is still attached to the document,
      * therefore the window is visible.
      * 
      * Do not call this method directly, and do not change the window or view hierarchy in this
      * method. */
    protected closingAnimator(): Nullable<HIAnimator> {
        return null;
    }

    public get parent(): Nullable<HIWindow> {
        return this._parent === HIWindow._pseudoRoot ? null : this._parent;
    }

    public get children(): readonly HIWindow[] {
        return HIGetReadonlyProxy(this._children);
    }

    public addChildWindow(window: HIWindow): void {
        this._attachToParent(window);
    }

    public removeChildWindow(window: HIWindow): void {
        if (window._parent !== this) {
            throw new Error("The window is not a child of this window.");
        }
        window._detachFromParent();
    }

    public orderFront(sender?: any): void {
        let window = this as HIWindow;
        while (window._parent !== null && window._parent !== HIWindow._pseudoRoot) {
            window = window._parent;
        }

        window._attachToParent(HIWindow._pseudoRoot);
    }

    public orderOut(sender?: any): void {
        this._detachFromParent();
    }

    public makeKeyAndOrderFront(sender?: any): void {
        this.orderFront(sender);
        this.makeKeyWindow();
    }

    public get firstResponder(): HIResponder {
        return this._firstResponder;
    }

    public makeFirstResponder(responder: Nullable<HIResponder>): boolean {
        if (responder === this._firstResponder) {return true;}

        if (this._firstResponder !== this) {
            //  If the first responder refuses to resign, but it’s removed from the window,
            //  discard it anyway.
            if (!this._firstResponder.resignFirstResponder()
             && (this._firstResponder as HIView).window === this) {
                return false;
            }
        }

        if (responder === null || responder === this) {
            this._firstResponder = this;
            this._checkKeyDOMFocus();
            this._updateFocusRing();
            this.becomeFirstResponder();
            return true;
        }

        if (!(responder instanceof HIView) || responder.window !== this
         || !responder.becomeFirstResponder()) {
            this._firstResponder = this;
            this._checkKeyDOMFocus();
            this._updateFocusRing();
            this.becomeFirstResponder();
            return false;
        }

        this._firstResponder = responder;
        this._checkKeyDOMFocus();
        this._updateFocusRing();
        return true;
    }

    private _makeInitialFirstResponder(): void {
        let current = this._firstResponder;
        
        win: {
            if (!(current instanceof HIView)) {break win;}
            if (current.window !== this) {break win;}
            if (current.acceptsFirstResponder) {break win;}
            return;
        }

        let view = this.contentView as Nullable<HIView>;
        if (!view!.canBecomeKeyView) {view = view!.nextValidKeyView;}
        this.makeFirstResponder(view);
    }

    private _checkKeyDOMFocus(): void {
        if (this !== _HIKeyWindow) {return;}
        let view = this._firstResponder === this ? this._frameView : (this._firstResponder as HIView);
        let keyDOM = view.keyDOM;

        if (document.activeElement !== keyDOM) {
            const selector = "[tabindex], a, :is(button, input, select, textarea):not(:disabled)";
            if (!keyDOM.matches(selector)) {keyDOM.tabIndex = 0;}

            _HIWindowIsCheckingKeyDOMFocus = true;
            keyDOM.focus();
            _HIWindowIsCheckingKeyDOMFocus = false;
        }
    }

    /** @internal Also an SPI to `HIView`. */
    private _updateFocusRing(animated: boolean = true): void {
        animated &&= this._state === _HIWindowState.orderedIn;

        if (this._focusRingTimer !== 0) {
            clearTimeout(this._focusRingTimer);
            this._focusRingTimer = 0;
            this._focusRingDOM.classList.remove("animated");
        }

        if (this._firstResponder instanceof HIView && this._firstResponder.allowsFocusRing) {
            let keyDOM = this._firstResponder.keyDOM;
            let {x, y, width, height} = keyDOM.getBoundingClientRect();
            let {x: windowX, y: windowY} = this._frameView.frame;
            x += window.scrollX - windowX;
            y += window.scrollY - windowY;

            this._focusRingDOM.style.left = x + "px";
            this._focusRingDOM.style.top = y + "px";
            this._focusRingDOM.style.width = width + "px";
            this._focusRingDOM.style.height = height + "px";
            this._focusRingDOM.style.borderRadius = getComputedStyle(keyDOM).borderRadius;

            this._focusRingDOM.hidden = false;

            if (animated) {
                this._focusRingDOM.classList.add("animated");
                this._focusRingTimer = setTimeout(() => {
                    this._focusRingTimer = 0;
                    this._focusRingDOM.classList.remove("animated");
                }, 250);
            }

        } else {
            this._focusRingDOM.hidden = true;
        }
    }

    /** @internal SPI to `HIView`. */
    private _setViewTreeNeedsLayout(): void {
        if (this._viewTreeNeedsLayout) {return;}
        this._viewTreeNeedsLayout = true;

        if (this._state !== _HIWindowState.orderedOut) {
            this._triggerDelayedViewTreeLayoutIfNeeded();
        }
    }

    private _triggerDelayedViewTreeLayoutIfNeeded(): void {
        if (!this._viewTreeNeedsLayout) {return;}
        if (this._queuedViewTreeLayout) {return;}

        this._queuedViewTreeLayout = true;
        queueMicrotask(() => {
            this._queuedViewTreeLayout = false;

            //  Since we can’t cancel the microtask, we need to check the flag again.
            if (!this._viewTreeNeedsLayout) {return;}
            if (this._state === _HIWindowState.orderedOut) {return;}

            this._frameView.layoutSubtreeIfNeeded();

            //  We perform the layout first, and then reset the flag, to prevent
            //  `_setViewTreeNeedsLayout` again from the layout process.
            this._viewTreeNeedsLayout = false;
        });
    }

    /** @internal SPI to `HIView`. */
    private _setViewTreeNeedsDisplay(): void {
        if (this._viewTreeNeedsDisplay) {return;}
        this._viewTreeNeedsDisplay = true;

        if (this._state !== _HIWindowState.orderedOut) {
            this._startDelayedViewTreeDisplayIfNeeded();
        }
    }

    private _startDelayedViewTreeDisplayIfNeeded(): void {
        if (!this._viewTreeNeedsDisplay) {return;}
        if (this._delayedViewTreeDisplay) {return;}

        this._delayedViewTreeDisplay = requestAnimationFrame(() => {
            this._delayedViewTreeDisplay = 0;
            this._frameView.displayIfNeeded();

            //  We perform the display first, and then reset the flag, to prevent
            //  `_setViewTreeNeedsDisplay` again from the display process.
            this._viewTreeNeedsDisplay = false;
        });
    }

    private _cancelDelayedViewTreeDisplay(): void {
        if (this._delayedViewTreeDisplay !== 0) {
            cancelAnimationFrame(this._delayedViewTreeDisplay);
            this._delayedViewTreeDisplay = 0;
        }
    }

    public selectNextKeyView(sender?: any) {
        let view = this._firstResponder === this ? this._frameView : (this._firstResponder as Nullable<HIView>);
        do {view = view!.nextValidKeyView;}
        while (view !== null && !this.makeFirstResponder(view));
    }

    public selectPreviousKeyView(sender?: any) {
        let view = this._firstResponder === this ? this._frameView : (this._firstResponder as Nullable<HIView>);
        do {view = view!.previousValidKeyView;}
        while (view !== null && !this.makeFirstResponder(view));
    }

    public override keyDown(event: HIEvent<KeyboardEvent>): void {
        if (event.native.key === "Tab") {
            event.native.shiftKey
                ? this.selectPreviousKeyView()
                : this.selectNextKeyView();
        } else {
            //  We allow the default behavior of the key event, so Shift-Meta-I can open the web inspector.
            super.keyDown(event);
        }
    }

    public targetForAction<T extends HISelector>(selector: T, toTarget: Nullable<{}>, fromSender: any): Nullable<{[K in T]: (sender?: any) => void}> {
        if (toTarget !== null) {
            let impl = Reflect.get(toTarget, selector);
            if (typeof impl === "function" && impl.length <= 1) {
                return toTarget as any;
            }
        }

        let responder = this._firstResponder as Nullable<HIResponder>;
        while (responder !== null) {
            let impl = Reflect.get(responder, selector);
            if (typeof impl === "function" && impl.length <= 1) {
                return responder as any;
            }
            responder = responder.nextResponder;
        }

        return null;
    }

    public sendAction(selector: HISelector, toTarget: Nullable<{}>, fromSender: any): boolean {
        let target = this.targetForAction(selector, toTarget, fromSender);
        if (target === null) {return false;}
        Reflect.get(target, selector).call(target, fromSender);
        return true;
    }
}
