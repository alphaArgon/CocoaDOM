/*
 *  HIResponder.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/14.
 *  Copyright © 2024 alphaArgon.
 */

import { _HIEventQuickTypeMask, _HIEventQuickTypeMaskSelectors, _HIResponderMetadata, _HIResponderMetadataKey } from "./_HIInternal.js";


const HIIsApplePlatform = navigator.platform.startsWith("Mac") || navigator.platform.startsWith("iP");


/** A.k.a. Property Key. */
export type HISelector<T = any> = (string | symbol) & keyof T;


export const enum HIEventType {
    mouseDown           = 1 << 0,
    mouseDragged        = 1 << 1,
    mouseUp             = 1 << 2,
    rightMouseDown      = 1 << 3,
    rightMouseDragged   = 1 << 4,
    rightMouseUp        = 1 << 5,
    otherMouseDown      = 1 << 6,
    otherMouseDragged   = 1 << 7,
    otherMouseUp        = 1 << 8,
    mouseEntered        = 1 << 9,
    mouseExited         = 1 << 10,
    mouseMoved          = 1 << 11,
    scrollWheel         = 1 << 12,
    keyDown             = 1 << 13,
    keyUp               = 1 << 14,
}


export type HIEventTypeMask = HIEventType;


/** A wrapper of DOM event. */
export class HIEvent<Native extends Event = Event> {

    public readonly type: HIEventType;
    public readonly native: Native;
    private _responseless: boolean;
    private _allowsNativeDefault: boolean;

    public constructor(type: HIEventType, native: Native) {
        this.type = type;
        this.native = native;
        this._responseless = false;
        this._allowsNativeDefault = false;
    }

    /** Allows the default behavior of the native event. For example, if the event is a mouse wheel,
      * the related element will be scrolled.
      * 
      * By default, if the event is pushed into the stack, the default behavior will be prevented.
      * Note that the default behavior won’t be executed immediately. You may use `queueMicrotask`
      * to do something after the action is performed. */
    public setAllowsNativeDefault(): void {
        this._allowsNativeDefault = true;
    }

    public get allowsNativeDefault(): boolean {
        return this._allowsNativeDefault;
    }

    /** Marks the event as responseless.
      *
      * Calling this method will also sets `allowsNativeDefault` to `true`. */ 
    public setResponseless(): void {
        this._responseless = true;
        this._allowsNativeDefault = true;
    }

    public get isResponseless(): boolean {
        return this._responseless;
    }

    private static _stack: HIEvent[] = [];

    public static get current(): Nullable<HIEvent> {
        return this._stack.length ? this._stack[this._stack.length - 1] : null;
    }

    /** Pushes a new event into the stack.
      * 
      * Once an event is pushed, the native event will be stopped from propagating. */
    public static push(event: HIEvent): void {
        event.native.stopPropagation();
        this._stack.push(event);
    }

    /** Pops the topmost event from the stack. If `assert` is passed, it will be checked against
      * the topmost.
      * 
      * If the `_allowsNativeDefault` is explicitly set to `true`, the default behavior of the
      * native event will be performed. */
    public static pop(assert?: HIEvent): HIEvent {
        let event = this._stack.pop();
        if (event === undefined) {
            throw new Error("No current event.");
        }
        if (assert !== undefined && event !== assert) {
            throw new Error("The current event is not the expected one.");
        }

        if (!event.isResponseless && !event._allowsNativeDefault) {
            event.native.preventDefault();
        }

        return event;
    }

    public get isShiftKeyDown(): boolean {
        return (this.native as any).shiftKey === true;
    }

    public get isOptionKeyDown(): boolean {
        return (this.native as any).altKey === true;
    }

    public get isMetaKeyDown(): boolean {
        return HIIsApplePlatform
            ? (this.native as any).metaKey === true
            : (this.native as any).ctrlKey === true;
    }

    public isMouseInDOM(dom: Element): boolean {
        if (!(this.native instanceof MouseEvent)) {return false;}
        let {clientX: x, clientY: y} = this.native;
        let {left, top, right, bottom} = dom.getBoundingClientRect();
        return x >= left && x < right && y >= top && y < bottom;
    }
}


export abstract class HIResponder {

    /** Returns the metadata of the class.
      *
      * The metadata is defined on the prototype of the class, and is shared by all instances.
      * `HIResponder` uses the metadata to determine which event handlers are overridden by the
      * subclass, and to optimize the event passing. */ 
    public get classMetadata(): Readonly<_HIResponderMetadata> {
        let prototype = this.constructor.prototype;
        let desc = Object.getOwnPropertyDescriptor(prototype, _HIResponderMetadataKey);
        if (desc !== undefined) {
            return desc.value;
        } else {
            let metadata = (this.constructor as typeof HIResponder).makeClassMetadata();
            Object.defineProperty(prototype, _HIResponderMetadataKey, {value: metadata});
            return metadata;
        } 
    }

    /** Creates the metadata of the class.
      * 
      * This method is called when the first access to `classMetadata` is made. In the method, you
      * must call `super.makeClassMetadata()` to ensure the metadata is correctly initialized,
      * and add your own metadata to the returned object. */
    protected static makeClassMetadata(): _HIResponderMetadata {
        let prototype = this.prototype;
        let overrides = 0 as _HIEventQuickTypeMask;
        for (let [flag, ...selectors] of _HIEventQuickTypeMaskSelectors) {
            for (let selector of selectors) {
                if (prototype[selector] !== HIResponder.prototype[selector]) {
                    overrides |= flag;
                    break;
                }
            }
        }

        return {eventOverrides: overrides};
    }

    /** The next responder in the responder chain.
      * 
      * `HIResponder` doesn’t store or manage the next responder, and returns `null` by default.
      * Subclasses should override this property to return the next responder in the chain. For
      * example, an `HIView` returns its controller if it has one, or its superview if it doesn’t.
      * an `HIViewController` returns the superview of its view. */
    public get nextResponder(): Nullable<HIResponder> {
        return null;
    }

    public get acceptsFirstResponder(): boolean {
        return false;
    }

    public becomeFirstResponder(): boolean {
        return true;
    }

    public resignFirstResponder(): boolean {
        return true;
    }

    private _passUpEvent(event: HIEvent, selector: HISelector<HIResponder>): void {
        //  The following steps are eqivalent to the following code:
        //
        //     if (this._nextResponder !== null) {
        //         this._nextResponder[selector](event);
        //     } else {
        //         //  Mark the event as responseless.
        //     }
        //
        //  but optimized — maybe.

        let defaultImpl = HIResponder.prototype[selector] as Function;
        let responder = this.nextResponder;
        while (responder !== null) {
            let impl = responder[selector] as Function;
            if (impl !== defaultImpl) {
                return impl.call(responder, event);
            }
            responder = responder.nextResponder;
        }

        event.setResponseless();
    }

    //  The following methods, if not overridden, will pass the event to its next responder.
    //  Before calling these method (other for `super`), you should push a event into the stack
    //  and pop it after the call.
    //  During the event responding, if the event is not handled by any responder, the flag
    //  `isResponseless` will be set to `true`, and the caller may decide what to do next.

    public mouseDown(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseDown");
    }

    public mouseDragged(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseDragged");
    }

    public mouseUp(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseUp");
    }

    public rightMouseDown(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "rightMouseDown");
    }

    public rightMouseDragged(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "rightMouseDragged");
    }

    public rightMouseUp(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "rightMouseUp");
    }

    public otherMouseDown(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "otherMouseDown");
    }

    public otherMouseDragged(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "otherMouseDragged");
    }

    public otherMouseUp(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "otherMouseUp");
    }

    public mouseEntered(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseEntered");
    }

    public mouseExited(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseExited");
    }

    public mouseMoved(event: HIEvent<MouseEvent>): void {
        this._passUpEvent(event, "mouseMoved");
    }

    public scrollWheel(event: HIEvent<WheelEvent>): void {
        this._passUpEvent(event, "scrollWheel");
    }

    public keyDown(event: HIEvent<KeyboardEvent>): void {
        this._passUpEvent(event, "keyDown");
    }

    public keyUp(event: HIEvent<KeyboardEvent>): void {
        this._passUpEvent(event, "keyUp");
    }
}
