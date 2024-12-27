/*
 *  HIView.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/10.
 *  Copyright © 2024 alphaArgon.
 */

import { HIEvent, HIEventType, HIResponder, HISelector } from "./HIResponder.js";
import { HIAppearance } from "./HIAppearance.js";
import { HIBFSTraversal, HIGetReadonlyProxy, HIMakeLCGID, HIPreOrderTraversal } from "./_HIUtils.js";
import { _HIEventQuickTypeMask, _HIEventQuickTypeMaskSelectors, _HIResponderMetadata, _HIWindowState, HITrackingAreaSPI, HIWindowSPI } from "./_HIInternal.js";
import type { HIWindow } from "./HIWindow.js";
import type { HIViewController } from "./HIViewController.js";
import type { HITrackingArea } from "./HITrackingArea.js";
import type { HIMenu } from "./HIMenu.js";
import type { HISize } from "./HIGeometry.js";


/** A wrapper of a DOM object that can be added to a view hierarchy. */
export class HIView extends HIResponder {

    private _uniqueID: Nullable<string>;

    private readonly _dom: HTMLElement;
    private _domRegisteredEvents: _HIEventQuickTypeMask;

    private _window: Nullable<HIWindow>;
    private _windowContent: boolean;

    private _superview: Nullable<HIView>;
    private _subviews: HIView[];

    /** The view controller. This is also an SPI to HIViewController. */
    private _delegate: Nullable<HIViewController>;

    private _trackingAreas: HITrackingArea[];

    private _needsLayoutState: number;  //  0: no; 1: yes; -1: laying out.
    private _needsDisplayState: number;  //  0: no; 1: yes; -1: displaying.

    private _needsCalculateSubviewKeyOrder: boolean;

    //  These two properties are set by the view itself.
    private _indexOfFirstKeySubview: number;  //  -1 if no subview.
    private _indexOfLastKeySubview: number;   //  -1 if no subview.

    //  These two properties are set by the superview. Invalid if no superview.
    private _indexOfNextKeySibling: number;  //  -1 if no next key sibling.
    private _indexOfPrevKeySibling: number;  //  -1 if no prev key sibling.

    private _appearance: Nullable<HIAppearance>;
    private _effectiveAppearance: HIAppearance;

    public constructor() {
        super();
        this._uniqueID = null;  //  Lazily initialized.

        this._dom = new.target.makeDOM();
        this._domRegisteredEvents = 0 as _HIEventQuickTypeMask;

        this._window = null;
        this._windowContent = false;

        this._superview = null;
        this._subviews = [];
        this._delegate = null;

        this._trackingAreas = [];

        this._needsLayoutState = 0;
        this._needsDisplayState = 0;

        this._needsCalculateSubviewKeyOrder = false;
        this._indexOfFirstKeySubview = -1;
        this._indexOfLastKeySubview = -1;
        this._indexOfNextKeySibling = -1;
        this._indexOfPrevKeySibling = -1;

        this._appearance = null;
        this._effectiveAppearance = HIAppearance.system;
    }

    protected static override makeClassMetadata(): _HIResponderMetadata {
        //  Instead calling `super.makeClassMetadata()`, we maintain the event overrides manually
        //  to avoid the overhead of the default implementation.

        let prototype = this.prototype;
        let overrides = 0 as _HIEventQuickTypeMask;
        for (let [flag, ...selectors] of _HIEventQuickTypeMaskSelectors) {
            for (let selector of selectors) {
                if (prototype[selector] !== HIView.prototype[selector]) {
                    overrides |= flag;
                    break;
                }
            }

            if (flag === _HIEventQuickTypeMask.mouseClicking) {
                //  If the view overrides the menu providing method, we need to register mouse
                //  events, so think of it as an override.
                let menuOverridden = prototype.menuForEvent !== HIView.prototype.menuForEvent;
                if (menuOverridden) {overrides |= flag;}
            }
        }

        return {eventOverrides: overrides};
    }

    //  MARK: Identity

    /** A auto-generated unique identifying string for the view.
      * 
      * The identifier starts with the lowercase class name of the view, followed by a hyphen and a
      * hexadecimal number. The number is unique within the application. */
    public get uniqueID(): string {
        if (this._uniqueID === null) {
            this._uniqueID = this.constructor.name.toLowerCase() + "-" + HIMakeLCGID();
        }

        return this._uniqueID;
    }

    /** A number that identifies the view.
      * 
      * `HIView` always returns `-1`. Subclasses, like `HIControl`, may override this property and
      * make it writable. */
    public get tag(): number {
        return -1;
    }

    //  MARK: DOM

    /** Creates a new DOM object for the `dom` property of a view.
      * 
      * By default, it creates a `div` element. Subclasses must return a new DOM object that is not
      * a descendant of other DOM object, not used by other views, and has no event listeners. */
    protected static makeDOM(): HTMLElement {
        return document.createElement("div");
    }

    /** The view’s DOM object for displaying content and capturing events.
      * 
      * This property is analogous to `layer` of a `UIView`. To use a custom DOM object, override
      * the static method `makeDOM`. */
    public get dom(): HTMLElement {
        return this._dom;
    }

    /** Returns a view that owns the specified DOM in the view hierarchy.
      *
      * The DOM of the returned view, if any, may not be exactly the same as the specified DOM, but
      * must be a nearest ancestor of the specified DOM that is associated with a view. */
    public viewWithDOM(dom: Node): Nullable<HIView> {
        let domChain = [] as Node[];
        let currentDOM = dom as Nullable<Node>;
        while (currentDOM !== null && currentDOM !== this._dom) {
            domChain.push(currentDOM);
            currentDOM = currentDOM.parentNode;
        }

        if (currentDOM === null) {return null;}

        let currentView = this as HIView;
        popDOM: while (domChain.length) {
            currentDOM = domChain.pop()!;
            for (let subview of currentView._subviews) {
                if (subview._dom === currentDOM) {
                    currentView = subview;
                    continue popDOM;
                }
            }

            //  Since the DOM of a subview may not be a direct child of the superview’s DOM,
            //  keep popping the DOM chain until the view is found.
        }

        return currentView;
    }

    //  MARK: View Hierarchy

    //  The lifecycle of a view in UIKit and AppKit is not the same. We take the version of AppKit.
    //    - oldSuperview?.willRemoveSubview
    //    - subview.willMoveToSuperview
    //    - (internal operations)
    //    - subview.didMoveToSuperview
    //    - newSuperview?.didAddSubview
    //  If window changes, then:
    //    - subview.willMoveToWindow
    //    - subview.didMoveToWindow

    public get window(): Nullable<HIWindow> {
        return this._window;
    }

    public get superview(): Nullable<HIView> {
        return this._superview;
    }

    public get subviews(): readonly HIView[] {
        return HIGetReadonlyProxy(this._subviews);
    }

    /** Returns whether the given view is identical to the receiver, a subview of the receiver, or
      * a descendant of the receiver. */
    public isDescendantOf(view: HIView): boolean {
        let superview = view._superview;
        let ancestor = this as Nullable<HIView>;
        do {
            if (ancestor === superview) {return false;}
            if (ancestor === view) {return true;}
            ancestor = ancestor!._superview;
        } while (ancestor !== null);
        return false;
    }

    /** Returns the closest common ancestor of the receiver and the specified view. */
    public ancestorSharedWith(view: HIView): Nullable<HIView> {
        if (this === view) {return this;}

        let thisRoot = this as HIView;
        let thisDepth = 0;
        while (thisRoot._superview !== null) {
            thisRoot = thisRoot._superview;
            thisDepth += 1;
        }

        let viewRoot = view as HIView;
        let viewDepth = 0;
        while (viewRoot._superview !== null) {
            viewRoot = viewRoot._superview;
            viewDepth += 1;
        }

        if (thisRoot !== viewRoot) {return null;}

        let thisAncestor = this as HIView;
        let viewAncestor = view as HIView;

        while (thisDepth > viewDepth) {
            thisAncestor = thisAncestor._superview!;
            thisDepth -= 1;
        }

        while (viewDepth > thisDepth) {
            viewAncestor = viewAncestor._superview!;
            viewDepth -= 1;
        }

        while (thisAncestor !== viewAncestor) {
            thisAncestor = thisAncestor._superview!;
            viewAncestor = viewAncestor._superview!;
        }

        return thisAncestor;
    }

    /** Adds the view into the list of subviews of the receiver.
      * 
      * Unlike `UIView`, if the subview is already a subview of the view, it won’t be moved to the
      * end of the subviews array. */
    public addSubview(view: HIView): void {
        if (view._superview === this) {return;}
        this.insertSubview(view, this._subviews.length);
    }

    /** Inserts the view into the list of subviews at the specified index.
      * 
      * If the subview is already a subview of the view, it will be moved to the specified position.
      * Otherwise if the subview is a subview of another view, it will be moved (not removed and
      * `removeFromSuperview` is not called) from the old superview into the view. */
    public insertSubview(view: HIView, index: number): void {
        let subviewCount = this._subviews.length;
        if (index < 0 || index > subviewCount) {
            throw new RangeError(`Index ${index} out of bounds 0...${subviewCount}`);
        }

        let viewSuper = view._superview;
        if (viewSuper === this) {
            let oldIndex = this._subviews.indexOf(view);
            if (oldIndex === index) {return;}  //  No change.

            if (index === subviewCount) {index -= 1;}
            this._subviews.splice(oldIndex, 1);
            this.insertDOMOfProposedSubview(view, index);
            this._subviews.splice(index, 0, view);

        } else {
            viewSuper?.willRemoveSubview(view);
            view.willMoveToSuperview(this);

            if (viewSuper !== null) {
                let dropIndex = viewSuper._subviews.indexOf(view);
                viewSuper._subviews.splice(dropIndex, 1);
                viewSuper.setNeedsLayout();
                viewSuper._setNeedsCalculateSubviewKeyOrder();
            }

            view._superview = this;
            this.insertDOMOfProposedSubview(view, index);
            this._subviews.splice(index, 0, view);

            view.didMoveToSuperview();
            this.didAddSubview(view);

            view._setWindow(this._window);
            view._didChangeInheritedAppearance(this._effectiveAppearance);
        }

        view.setNeedsLayout();
        this.setNeedsLayout();
        this._setNeedsCalculateSubviewKeyOrder();
    }

    /** Removes the view from its superview, and removes the DOM from the DOM of the superview. */
    public removeFromSuperview(): void {
        let superview = this._superview;
        if (superview === null) {return;}

        superview.willRemoveSubview(this);
        this.willMoveToSuperview(null);

        let dropIndex = superview._subviews.indexOf(this);
        superview._subviews.splice(dropIndex, 1);
        this._superview = null;
        this._dom.remove();

        this.didMoveToSuperview();
        this._setWindow(null);

        superview.setNeedsLayout();
        superview._setNeedsCalculateSubviewKeyOrder();
    }

    public replaceSubview(subview: HIView, replacement: HIView): void {
        if (subview._superview !== this) {
            throw new Error("The view to be replaced is not a subview of the view.");
        }

        if (subview === replacement) {return;}

        this.willRemoveSubview(subview);
        subview.willMoveToSuperview(null);

        let replaceIndex = this._subviews.indexOf(subview);

        let replacementSuper = replacement._superview;
        if (replacementSuper === this) {
            let dropIndex = this._subviews.indexOf(replacement);
            this._subviews.splice(dropIndex, 1);

            if (replaceIndex > dropIndex) {replaceIndex -= 1;}
            this._subviews.splice(replaceIndex, 1);
            subview._superview = null;
            subview._dom.remove();

            this.insertDOMOfProposedSubview(replacement, replaceIndex);
            this._subviews.splice(replaceIndex, 0, replacement);

        } else {
            replacementSuper?.willRemoveSubview(replacement);
            replacement.willMoveToSuperview(this);

            if (replacementSuper !== null) {
                let dropIndex = replacementSuper._subviews.indexOf(replacement);
                replacementSuper._subviews.splice(dropIndex, 1);
                replacementSuper.setNeedsLayout();
                replacementSuper._setNeedsCalculateSubviewKeyOrder();
            }

            this._subviews.splice(replaceIndex, 1);
            subview._superview = null;
            subview._dom.remove();

            replacement._superview = this;
            this.insertDOMOfProposedSubview(replacement, replaceIndex);
            this._subviews.splice(replaceIndex, 0, replacement);

            replacement.didMoveToSuperview();
            this.didAddSubview(replacement);

            replacement._setWindow(this._window);
            replacement._didChangeInheritedAppearance(this._effectiveAppearance);
        }

        subview.didMoveToSuperview();
        subview._setWindow(null);

        replacement.setNeedsLayout();
        this.setNeedsLayout();
        this._setNeedsCalculateSubviewKeyOrder();
    }

    /** Inserts the dom of the proposed subview into the DOM of the view.
      * 
      * The default implementation appends the DOM of the proposed subview to the DOM of the view
      * if the proposed subview will be the last subview, otherwise inserts it before the DOM of its
      * next sibling subview.
      * 
      * This method is called from `insertSubview`, `addSubview`, or `replaceSubview`, before the
      * subview is inserted into the subviews array. If the subview was already a subview of the
      * view, it will be temporarily removed from the subviews array before being inserted back.
      * 
      * Subclasses may override this method to customize the behavior.
      * However, it’s an undefined behavior to insert the DOM of the proposed subview outside the
      * DOM of the view, or into another subview’s DOM.
      * 
      * For simplicity, it’s OK to insert the DOM first, and then insert the subview to the view
      * hierarchy. However, in this case, it’s the responsibility of the subclass to exclude such
      * subviews in this method and do not call `super`, otherwise the DOM will be moved to the
      * default position.
      * 
      * Do not call this method directly. */
    protected insertDOMOfProposedSubview(subview: HIView, proposedIndex: number): void {
        proposedIndex === this._subviews.length
            ? this._dom.appendChild(subview._dom)
            : this._dom.insertBefore(subview._dom, this._subviews[proposedIndex]._dom);
    }

    /** @internal SPI to HIViewController */
    private _setDelegate(delegate: Nullable<HIViewController>): void {
        this._delegate = delegate;
    }

    /** Sets whether the view is the content view of its window. Should be called before the view is
      * inserted into the view hierarchy.
      * 
      * @internal SPI to _HIFrameView */
    private _setWindowContent(flag: boolean): void {
        this._windowContent = flag;
    }

    /** Sets the window of the view and all its descendants. If a descendant is the first responder
      * of the old window, it will resign first responder status.
      * 
      * @internal Also an SPI to HIWindow. */
    private _setWindow(window: Nullable<HIWindow>) {
        let oldWindow = this._window;
        if (oldWindow === window) {return;}

        let oldState = oldWindow === null ? _HIWindowState.orderedOut : (oldWindow as any as HIWindowSPI)._state;
        let newState = window === null ? _HIWindowState.orderedOut : (window as any as HIWindowSPI)._state;

        let willAppear = false, didAppear = false, willDisappear = false, didDisappear = false;

        //  (willAppear -> (didAppear -> willDisappear)* -> didDisappear)*
        switch ((oldState << 2) | newState) {
        case  0: /* hidden -> hidden */     break;
        case  1: /* hidden -> showing */    willAppear = true; break;
        case  2: /* hidden -> shown */      willAppear = true; didAppear = true; break;
        case  3: /* hidden -> hiding */     willAppear = true; break;

        case  4: /* showing -> hidden */    didDisappear = true; break;
        case  5: /* showing -> showing */   break;
        case  6: /* showing -> shown */     didAppear = true; break;
        case  7: /* showing -> hiding */    break;

        case  8: /* shown -> hidden */      willDisappear = true; didDisappear = true; break;
        case  9: /* shown -> showing */     willDisappear = true; break;
        case 10: /* shown -> shown */       break;
        case 11: /* shown -> hiding */      willDisappear = true; break;

        case 12: /* hiding -> hidden */     didDisappear = true; break;
        case 13: /* hiding -> showing */    break;
        case 14: /* hiding -> shown */      didAppear = true; break;
        case 15: /* hiding -> hiding */     break;
        }

        let oldFirstResponder = oldWindow === null ? null : oldWindow.firstResponder;

        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view.willMoveToWindow(window);

            if (willAppear) {view._willAppear();}
            else if (willDisappear) {view._willDisappear();}

            view._window = window;

            if (view === oldFirstResponder) {
                oldWindow!.makeFirstResponder(null);
                oldFirstResponder = null;
            }
        }

        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view.didMoveToWindow();

            if (didAppear) {view._didAppear();}
            else if (didDisappear) {view._didDisappear();}

            view._updateDOMEventRegistration();
        }

        if (oldWindow !== null) {
            (oldWindow as any as HIWindowSPI)._setViewTreeNeedsLayout();
            (oldWindow as any as HIWindowSPI)._setViewTreeNeedsDisplay();
        }

        if (window !== null) {
            (window as any as HIWindowSPI)._setViewTreeNeedsLayout();
            (window as any as HIWindowSPI)._setViewTreeNeedsDisplay();
        }
    }

    /** @internal SPIs to HIWindow */
    private _windowWillAppear(): void {
        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view._willAppear();
        }
    }

    private _windowDidAppear(): void {
        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view._didAppear();
        }
    }

    private _windowWillDisappear(): void {
        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view._willDisappear();
        }
    }

    private _windowDidDisappear(): void {
        for (let view of HIBFSTraversal(this as HIView, "_subviews" as any)) {
            view._didDisappear();
        }
    }

    public willMoveToWindow(window: Nullable<HIWindow>): void {return;}
    public didMoveToWindow(): void {return;}

    public willMoveToSuperview(superview: Nullable<HIView>): void {return;}
    public didMoveToSuperview(): void {return;}

    public willRemoveSubview(subview: HIView): void {return;}
    public didAddSubview(subview: HIView): void {return;}

    //  MARK: Event Handling

    //  If an event is not captured by any DOM object in the view hierarchy, it does what the user
    //  agent does by default. If the no corresponding view event handler is overridden, the view
    //  won’t register that DOM event.
    //
    //  When the DOM of a view captures an event, the view will disable the default bubbling
    //  mechanism (by `stopPropagation`), and dispatch the event to the corresponding view event
    //  handler. The default implementation simply passes the event to the view’s superview, which
    //  is the same as the bubbling mechanism in the DOM. If the event finally reaches the root
    //  view (typically the content view of the window), or a view explicitly sets true to
    //  `allowsDefaultActionForCurrentEvent`, the event is marked not to prevent the default action.
    //
    //  After the event is dispatched to the handler, we are still in the capturing phase. If the
    //  event is marked to prevent the default action, `preventDefault` is called on the event.

    public override get nextResponder(): Nullable<HIResponder> {
        if (this._delegate !== null) {return this._delegate;}
        return this._nextResponderIgnoringDelegate;
    }

    /** @internal SPI to HIViewController */
    private get _nextResponderIgnoringDelegate(): Nullable<HIResponder> {
        if (this._window !== null && this._windowContent) {return this._window;}
        return this._superview;
    }

    public get trackingAreas(): readonly HITrackingArea[] {
        return HIGetReadonlyProxy(this._trackingAreas);
    }

    public addTrackingArea(trackingArea: HITrackingArea): void {
        if (trackingArea.owner !== null) {
            throw new Error("The tracking area is already owned by another view.");
        }

        (trackingArea as any as HITrackingAreaSPI)._setOwner(this);
        this._trackingAreas.push(trackingArea);
    }

    public removeTrackingArea(trackingArea: HITrackingArea): void {
        if (trackingArea.owner !== this) {return;}

        (trackingArea as any as HITrackingAreaSPI)._setOwner(null);
        this._trackingAreas.splice(this._trackingAreas.indexOf(trackingArea), 1);
    }

    public menuForEvent(event: HIEvent): Nullable<HIMenu> {
        return null;
    }

    public override rightMouseDown(event: HIEvent<MouseEvent>): void {
        let menu = this.menuForEvent(event);
        if (menu !== null) {
            menu.popUpContextMenu(event, this);
        } else {
            super.rightMouseDown(event);
        }
    }

    /** Call this method when the view is added to a window. */
    private _updateDOMEventRegistration(): void {
        //  The view needs to register an event if, in the responder chain from the view (inclusive)
        //  to its superview (exclusive), there is a responder that overrides the event.
        //
        //  For simplicity, we check up to three responders. If no superview found, register all
        //  events. This case also covers that the view is the content view of the window.

        let eventsToRegister = 0 as _HIEventQuickTypeMask;
        let endResponder = this as Nullable<HIResponder>;

        let nextResponderCount = 3;
        while (endResponder !== null
            && endResponder !== this._superview
            && nextResponderCount > 0
        ) {
            eventsToRegister |= endResponder.classMetadata.eventOverrides;
            endResponder = endResponder.nextResponder;
            nextResponderCount -= 1;
        }

        if (endResponder !== this._superview) {
            eventsToRegister = _HIEventQuickTypeMask.maskAll;
        }

        let toRemove = this._domRegisteredEvents & ~eventsToRegister;
        let toAdd = eventsToRegister & ~this._domRegisteredEvents;
        this._domRegisteredEvents = eventsToRegister;

        if (toRemove & _HIEventQuickTypeMask.mouseClicking) {
            this._dom.removeEventListener("mousedown", this);
        }
        if (toRemove & _HIEventQuickTypeMask.scrollWheel) {
            this._dom.removeEventListener("wheel", this);
        }
        if (toRemove & _HIEventQuickTypeMask.keyPress) {
            this._dom.removeEventListener("keydown", this);
            this._dom.removeEventListener("keyup", this);
        }

        if (toAdd & _HIEventQuickTypeMask.mouseClicking) {
            this._dom.addEventListener("mousedown", this);
        }
        if (toAdd & _HIEventQuickTypeMask.scrollWheel) {
            this._dom.addEventListener("wheel", this);
        }
        if (toAdd & _HIEventQuickTypeMask.keyPress) {
            this._dom.addEventListener("keydown", this);
            this._dom.addEventListener("keyup", this);
        }
    }

    /** @protected To make TypeScript happy. */
    public handleEvent(nativeEvent: Event): void {
        if (this._window === null) {
            return;  //  This should not happen in practice.
        }

        let event: HIEvent;
        let selector: HISelector<HIResponder>;

        switch (nativeEvent.type) {
        case "mousedown":
            //  Mouse events are handled by the window.
            (this._window as any as HIWindowSPI)._viewDOMMouseDown(this, nativeEvent as MouseEvent);
            return;

        case "wheel":
            event = new HIEvent(HIEventType.scrollWheel, nativeEvent);
            selector = "scrollWheel"; break;
        case "keydown":
            event = new HIEvent(HIEventType.keyDown, nativeEvent);
            selector = "keyDown"; break;
        case "keyup":
            event = new HIEvent(HIEventType.keyUp, nativeEvent);
            selector = "keyUp"; break;
        default: return;
        }

        HIEvent.push(event);
        (this as any)[selector](event);
        HIEvent.pop(event);
    }

    //  MARK: First Responder

    /** Whether the view accepts mouse down events that make its window key. */
    public acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return false;
    }

    /** Whether its window is ordered front at mouse down or mouse up.
      * 
      * To completely prevent the window from being ordered, call `preventOrdering` on its window. */
    public shouldDelayWindowOrdering(event: HIEvent<MouseEvent>): boolean {
        return false;
    }

    /** Whether clicking the view makes it the first responder, and makes its window key. */
    public get needsPanelToBecomeKey(): boolean {
        return this.acceptsFirstResponder;
    }

    public get canBecomeKeyView(): boolean {
        let window = this._window;
        if (window === null) {return false;}
        //  TODO: Whether the view is visible, and the window accepts keybord input.
        return this.acceptsFirstResponder;
    }

    /** Marks the subview key order as dirty, or calculates it immediately if necessary. */
    private _setNeedsCalculateSubviewKeyOrder(): void {
        this._needsCalculateSubviewKeyOrder = true;

        if (this._window !== null && this._window.isVisible) {
            this._calculateSubviewKeyOrderIfNeeded();
        }
    }

    /** Calculates the subview key order immediately if it was marked as dirty. */
    private _calculateSubviewKeyOrderIfNeeded(): void {
        if (!this._needsCalculateSubviewKeyOrder) {return;}
        this._needsCalculateSubviewKeyOrder = false;

        if (this._subviews.length === 0) {
            this._indexOfFirstKeySubview = -1;
            this._indexOfLastKeySubview = -1;
            return;
        }

        //  AppKit sorts the subviews by the top-left corner of the frame.
        //  We don’t have frame yet, so we sort by their DOM order.
        let order = this._subviews.map((view, index) => ({view, index})).sort((a, b) => {
            switch (a.view._dom.compareDocumentPosition(b.view._dom)) {
            case Node.DOCUMENT_POSITION_FOLLOWING: return -1;
            case Node.DOCUMENT_POSITION_PRECEDING: return 1;
            default: throw new Error("The DOM objects of two subviews are not well-orderd.");
            }
        });

        this._indexOfFirstKeySubview = order[0].index;
        this._indexOfLastKeySubview = order[order.length - 1].index;

        order[0].view._indexOfPrevKeySibling = -1;

        for (let i = 1; i < order.length; ++i) {
            order[i - 1].view._indexOfNextKeySibling = order[i].index;
            order[i].view._indexOfPrevKeySibling = order[i - 1].index;
        }

        order[order.length - 1].view._indexOfNextKeySibling = -1;
    }

    private _nextKeyViewUntil(predicate: (view: HIView) => boolean): Nullable<HIView> {
        let view = this as HIView;
        while (true) {
            //  The chain of next key view is the same as pre-order traversal.

            if (view._subviews.length) {
                view._calculateSubviewKeyOrderIfNeeded();
                view = view._subviews[view._indexOfFirstKeySubview];

            } else while (true) {
                let superview = view._superview;
                if (superview === null) {
                    //  Chain ends here. Move to the first key view to restart the chain.
                    //  Now view is the root of the view hierarchy.
                    break;
                }

                superview._calculateSubviewKeyOrderIfNeeded();
                if (view._indexOfNextKeySibling !== -1) {
                    view = superview._subviews[view._indexOfNextKeySibling];
                    break;
                }

                view = superview;
            }

            if (view === this) {return null;}  //  Loop restarts.
            if (predicate(view)) {return view;}
        }
    }

    private _prevKeyViewUntil(predicate: (view: HIView) => boolean): Nullable<HIView> {
        let view = this as HIView;
        while (true) {
            //  The chain of previous key view is the reverse of next key view chain,
            //  which is the same as post-order traversal of the reversed tree.

            let superview = view._superview;
            if (superview === null) {
                //  Chain starts here. Move to the last key view to restart the chain,
                while (view._subviews.length) {
                    view._calculateSubviewKeyOrderIfNeeded();
                    view = view._subviews[view._indexOfLastKeySubview];
                }

            } else {
                superview._calculateSubviewKeyOrderIfNeeded();
                if (view._indexOfPrevKeySibling === -1) {
                    view = superview;

                } else {
                    view = superview._subviews[view._indexOfPrevKeySibling];
                    while (view._subviews.length) {
                        view._calculateSubviewKeyOrderIfNeeded();
                        view = view._subviews[view._indexOfLastKeySubview];
                    }
                }
            }

            if (view === this) {return null;}  //  Loop restarts.
            if (predicate(view)) {return view;}
        }
    }

    public get nextKeyView(): Nullable<HIView> {
        return this._nextKeyViewUntil(() => true);
    }

    public get previousKeyView(): Nullable<HIView> {
        return this._prevKeyViewUntil(() => true);
    }

    public get nextValidKeyView(): Nullable<HIView> {
        return this._nextKeyViewUntil(view => view.canBecomeKeyView);
    }

    public get previousValidKeyView(): Nullable<HIView> {
        return this._prevKeyViewUntil(view => view.canBecomeKeyView);
    }

    /** Returns the DOM object to be focused when the view becomes the first responder.
      * 
      * By default, it returns the view’s DOM object. Subclasses can return other DOM object that
      * is descendant of the view’s DOM object, but not owned by other views. That is, calling
      * `viewWithDOM` with the returned DOM object needs to return the view itself.
      * 
      * If the DOM object is not focusable, a `tabindex` attribute will be added to it before the
      * view becomes the first responder. */
    public get keyDOM(): HTMLElement {
        return this._dom;
    }

    //  MARK: Layout

    /** Updates the contents of the view that are dependent on the view’s size. 
      * 
      * In most cases, the view should manipulate their style using CSS. Override this method only
      * for complex appearance that cannot be achieved by CSS. */
    public layout(): void {}

    public get needsLayout(): boolean {
        return this._needsLayoutState === 1;
    }

    /** Marks the view as needing layout.
      * 
      * This method is automatically called when a subview is added to / removed from the view, or
      * the view is added to a superview.
      * 
      * By default, `HIView` does not and does not know how to observe the size change of the view.
      * Custom container views, like `HIBox`, should call this method for their subviews on
      * appropriate occasions. */
    public setNeedsLayout() {
        if (this.layout === HIView.prototype.layout) {return;}
        if (this._needsLayoutState !== 0) {return;}
        this._needsLayoutState = 1;

        if (this._window !== null) {
            (this._window as any as HIWindowSPI)._setViewTreeNeedsLayout();
        }

        this.setNeedsDisplay();
    }

    public layoutSubtreeIfNeeded(): void {
        if (this._window === null) {return;}
        if ((this._window as any as HIWindowSPI)._state === _HIWindowState.orderedOut) {return;}
        let firstResponder = this._window.firstResponder;
        let metFirstResponder = false;

        //  Laying out should use a ordered traversal.
        for (let view of HIPreOrderTraversal(this as HIView, "_subviews" as any)) {
            if (view === firstResponder) {
                metFirstResponder = true;
            }

            if (view._needsLayoutState !== 1) {continue;}
            view._needsLayoutState = -1;
            view.layout();
            view._needsLayoutState = 0;
        }

        if (metFirstResponder) {
            (this._window as any as HIWindowSPI)._updateFocusRing(false);
        }
    }

    public get preferredSize(): Readonly<HISize> {
        return {width: -1, height: -1};
    }

    public static get noPreferredMetric(): number {
        return -1;
    }

    //  MARK: Appearance

    private _willAppear(): void {
        this.appearance?.applyForDOM(this.appearanceDOM);
        this.willUnhide();
        this._delegate?.viewWillAppear();
    }

    private _didAppear(): void {
        this.didUnhide();
        this._delegate?.viewDidAppear();
    }

    private _willDisappear(): void {
        this.willHide();
        this._delegate?.viewWillDisappear();
    }

    private _didDisappear(): void {
        this.didHide();
        this._delegate?.viewDidDisappear();
        HIAppearance.disposeForDOM(this.appearanceDOM);
    }

    public willUnhide(): void {}
    public didUnhide(): void {}
    public willHide(): void {}
    public didHide(): void {}

    public get isHidden(): boolean {
        if (this._window === null) {return true;}
        return (this._window as any as HIWindowSPI)._state === _HIWindowState.orderedOut;
    }

    /** Displays the view on the screen.
      * 
      * In most cases, the view should manipulate their style using CSS. Override this method only
      * if you are doing custom drawing. */
    public display(): void {}

    public get needsDisplay(): boolean {
        return this._needsDisplayState === 1;
    }

    /** Marks the view as needing display.
      * 
      * This method is automatically called from `setNeedsLayout` or after the effective appearance
      * is changed. */
    public setNeedsDisplay() {
        if (this.display === HIView.prototype.display) {return;}
        if (this._needsDisplayState !== 0) {return;}
        this._needsDisplayState = 1;

        if (this._window !== null) {
            (this._window as any as HIWindowSPI)._setViewTreeNeedsDisplay();
        }
    }

    public displayIfNeeded(): void {
        if (this._window === null) {return;}
        if ((this._window as any as HIWindowSPI)._state === _HIWindowState.orderedOut) {return;}

        for (let view of HIPreOrderTraversal(this as HIView, "_subviews" as any)) {
            if (view._needsDisplayState !== 1) {continue;}
            view._needsDisplayState = -1;
            view._effectiveAppearance.asCurrent(() => view.display());
            view._needsDisplayState = 0;
        }
    }

    /** Whether the view shows the focus ring when it becomes the first responder. If true, a focus
     * ring will be drawn around the view’s key DOM object.
      * 
      * The default implementation returns `false`. `HIControl` returns `true`. */
    public get allowsFocusRing(): boolean {
        return false;
    }

    public noteFocusRingChanged(): void {
        if (this === this._window?.firstResponder) {
            (this._window as any as HIWindowSPI)._updateFocusRing(false);
        }
    }

    public get appearanceDOM(): HTMLElement {
        return this._dom;
    }

    public get appearance(): Nullable<HIAppearance> {
        return this._appearance;
    }

    public set appearance(appearance: Nullable<HIAppearance>) {
        if (this._appearance === appearance) {return;}
        this._appearance = appearance;

        let effectiveAppearance = appearance;
        if (effectiveAppearance === null) {
            effectiveAppearance = this._superview === null
                ? HIAppearance.system
                : this._superview._effectiveAppearance;
        }

        if (this._effectiveAppearance !== effectiveAppearance) {
            this._effectiveAppearance = effectiveAppearance;
            this.didChangeEffectiveAppearance();
            this.setNeedsDisplay();

            for (let subview of this._subviews) {
                subview._didChangeInheritedAppearance(effectiveAppearance);
            }
        }

        if (this._window === null) {return;}
        if ((this._window as any as HIWindowSPI)._state === _HIWindowState.orderedOut) {return;}

        if (appearance !== null) {
            appearance.applyForDOM(this.appearanceDOM);
        } else {
            HIAppearance.disposeForDOM(this.appearanceDOM);
        }
    }

    public get effectiveAppearance(): HIAppearance {
        return this._effectiveAppearance;
    }

    /** @internal SPI to HIWindow */
    private _didChangeInheritedAppearance(appearance: HIAppearance): void {
        //  Here we don’t use `HIPreOrderTraversal` because if a view has its own appearance, its
        //  subtree should be pruned from the inherited appearance tree.

        if (this._appearance !== null) {return;}
        if (this._effectiveAppearance === appearance) {return;}
        this._effectiveAppearance = appearance;
        this.didChangeEffectiveAppearance();
        this.setNeedsDisplay();

        for (let subview of this._subviews) {
            subview._didChangeInheritedAppearance(appearance);
        }
    }

    public didChangeEffectiveAppearance(): void {}
}
