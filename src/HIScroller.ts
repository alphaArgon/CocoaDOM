/*
 *  HIScroller.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/29.
 *  Copyright © 2024 alphaArgon.
 */

import { HIControl } from "./HIControl.js";
import { HINotificationCenter, HINotificationName } from "./HINotification.js";
import { HIAppearance } from "./HIAppearance.js";
import { HISetDOMHasAttribute } from "./_HIUtils.js";
import type { HIEvent } from "./HIResponder.js";


let _HIPreferredScrollerStyle: Nullable<HIScrollerStyle> = null;

export const enum HIScrollerStyle {
    legacy, overlay
}


export class HIScroller extends HIControl {
    
    private _value: number;
    private _knobProportion: number;

    private _horizontal: boolean;
    private _style: HIScrollerStyle;

    private _trackDOM: HTMLElement;
    private _knobDOM: HTMLElement;

    private _mouseDrag: Nullable<{min: number, max: number, once: boolean}>;

    private _activeCount: number;
    private _delayedIdel: number;

    public constructor(horizontal: boolean = false) {
        super();
        this._value = 0;
        this._knobProportion = 0;

        this.dom.classList.add(horizontal ? "horizontal" : "vertical");
        this._horizontal = horizontal;

        this._style = -1 as HIScrollerStyle;
        this.style = HIScroller.preferredScrollerStyle;

        this._trackDOM = document.createElement("div");
        this._trackDOM.classList.add("hi-scroller-track");
        this.dom.appendChild(this._trackDOM);

        this._knobDOM = document.createElement("div");
        this._knobDOM.classList.add("hi-scroller-knob");
        this.dom.appendChild(this._knobDOM);

        this._mouseDrag = null;

        this._activeCount = 0;
        this._delayedIdel = 0;
        this.dom.classList.add("idle");

        this.isContinuous = true;
        this._updateKnobPosition();
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("span");
        dom.classList.add("hi-scroller");
        return dom;
    }

    public static readonly preferredScrollerStyleDidChangeNotification: HINotificationName<void> = "preferredScrollerStyleDidChange";

    public static get preferredScrollerStyle(): HIScrollerStyle {
        if (_HIPreferredScrollerStyle === null) {
            let outerBox = document.createElement("div");
            outerBox.style.width = "30px";
            outerBox.style.height = "30px";
            outerBox.style.overflow = "scroll";
            outerBox.style.visibility = "hidden";
            outerBox.style.position = "absolute";

            let innerBox = document.createElement("div");
            innerBox.style.width = "40px";
            innerBox.style.height = "40px";
            outerBox.appendChild(innerBox);

            document.body.appendChild(outerBox);
            _HIPreferredScrollerStyle = outerBox.offsetWidth === outerBox.clientWidth
                ? HIScrollerStyle.overlay
                : HIScrollerStyle.legacy;
        }

        return _HIPreferredScrollerStyle;
    }

    public static set preferredScrollerStyle(style: HIScrollerStyle) {
        if (_HIPreferredScrollerStyle === style) {return;}
        _HIPreferredScrollerStyle = style;
        HINotificationCenter.default.post(HIScroller.preferredScrollerStyleDidChangeNotification, null);
    }

    public get scrollerWidth(): number {
        return 16;  //  This value is written in CSS.
    }

    public get style(): HIScrollerStyle {
        return this._style;
    }

    public set style(style: HIScrollerStyle) {
        if (this._style === style) {return;}
        this._style = style;
        this.dom.classList.toggle("overlay", style === HIScrollerStyle.overlay);
    }

    public get value(): number {
        return this._value;
    }

    public set value(value: number) {
        let newValue = Math.min(1, Math.max(0, value));
        if (this._value === newValue) {return;}
        this._value = newValue;
        this._updateKnobPosition();
    }

    public get knobProportion(): number {
        return this._knobProportion;
    }

    public set knobProportion(proportion: number) {
        let newProportion = Math.min(1, Math.max(0, proportion));
        if (this._knobProportion === newProportion) {return;}
        this._knobProportion = newProportion;
        this._updateKnobPosition();
        this.dom.classList.toggle("full", newProportion === 1);
    }

    private _updateKnobPosition() {
        let value = this._value;
        let knobProp = this._knobProportion;

        let trackSize = this._horizontal ? this.dom.clientWidth : this.dom.clientHeight;
        let knobSize = trackSize * knobProp;

        const minKnobSize = 20;
        knobSize = Math.max(minKnobSize, knobSize);

        let effectiveTrackSize = trackSize - knobSize;
        let knobOffset = value * effectiveTrackSize;

        this.dom.style.setProperty("--knob-offset", knobOffset + "px");
        this.dom.style.setProperty("--knob-size", knobSize + "px");
        this.noteActive();
    }

    private _updateValue(event: HIEvent<MouseEvent>): void {
        let coord = this._horizontal ? event.native.clientX : event.native.clientY;

        let {min, max} = this._mouseDrag!;
        let value = (coord - min) / (max - min);

        if (!Number.isFinite(value)) {value = 0;}
        else {value = Math.min(1, Math.max(0, value));}

        this._value = value;
        this._updateKnobPosition();
    }

    public noteActive(): void {
        if (this._activeCount !== 0) {return;}
        if (this._delayedIdel) {return;}

        this.dom.classList.remove("idle");
        this._delayedIdel = setTimeout(() => {
            this._delayedIdel = 0;
            this.dom.classList.add("idle");
        });
    }

    public beginTracking(): void {
        if (this._delayedIdel) {
            clearTimeout(this._delayedIdel);
        } else {
            this.dom.classList.remove("idle");
        }

        this._activeCount += 1;
    }

    public endTracking(): void {
        this._activeCount -= 1;
        if (this._activeCount !== 0) {return;}

        this._delayedIdel = setTimeout(() => {
            this._delayedIdel = 0;
            this.dom.classList.add("idle");
        });
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDown(event);
        }

        let onKnob = event.native.target === this._knobDOM;

        let originKey = this._horizontal ? "x" : "y" as "x" | "y";
        let sizeKey = this._horizontal ? "width" : "height" as "width" | "height";

        let bounds = this.dom.getBoundingClientRect();
        let knobBounds = this._knobDOM.getBoundingClientRect();
        let min = bounds[originKey] + knobBounds[sizeKey] / 2;
        let max = bounds[originKey] + bounds[sizeKey] - knobBounds[sizeKey] / 2;

        this.beginTracking();
        HISetDOMHasAttribute(this.dom, "highlighted", true);

        this._mouseDrag = {min, max, once: false};
        if (onKnob) {
            let downAt = this._horizontal ? event.native.clientX : event.native.clientY;
            let eccentric = (knobBounds[originKey] + knobBounds[sizeKey] / 2) - downAt;
            this._mouseDrag.min -= eccentric;
            this._mouseDrag.max -= eccentric;
            return;
        }

        this._updateValue(event);

        if (this.isContinuous && this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override mouseDragged(event: HIEvent<MouseEvent>): void {
        if (this._mouseDrag === null) {
            return super.mouseDragged(event);
        }

        this._updateValue(event);
        this._mouseDrag.once = true;

        if (this.isContinuous && this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override mouseUp(event: HIEvent<MouseEvent>): void {
        if (this._mouseDrag === null) {
            return super.mouseDragged(event);
        }

        this.endTracking();
        HISetDOMHasAttribute(this.dom, "highlighted", false);
        if (!this._mouseDrag.once) {return;}

        this._updateValue(event);
        this._mouseDrag = null;

        if (this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override get acceptsFirstResponder(): boolean {
        return false;
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return this._style === HIScrollerStyle.legacy;
    }

    public override layout(): void {
        this._updateKnobPosition();
    }
}


{
    HIAppearance.addCSSVariableProvider("--hi-scroller-lecacy-color", appearance => {
        return appearance.isDark ? "#2b2b2b" : "#fafafa";
    });

    HIAppearance.addCSSVariableProvider("--hi-scroller-overlay-color", appearance => {
        return appearance.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(250, 250, 250, 0.75)";
    });

    HIAppearance.addCSSVariableProvider("--hi-scroller-knob-color", appearance => {
        return appearance.isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)";
    });

    HIAppearance.addCSSVariableProvider("--hi-scroller-knob-border-color", appearance => {
        return appearance.isDark ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)";
    });
}
