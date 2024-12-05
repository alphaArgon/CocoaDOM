/*
 *  HISlider.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/27.
 *  Copyright © 2024 alphaArgon.
 */

import { HIControl } from "./HIControl.js";
import { HIEvent, HISelector } from "./HIResponder.js";
import { HISetDOMHasAttribute } from "./_HIUtils.js";


export class HISlider extends HIControl {

    private _value: number;
    private _minValue: number;
    private _maxValue: number;

    private _trackDOM: HTMLElement;
    private _knobDOM: HTMLElement;

    private _mouseDrag: Nullable<{minX: number, maxX: number, once: boolean}>;

    public constructor(value: number, minValue: number, maxValue: number, target: Nullable<{}>, action: Nullable<HISelector>) {
        super();
        this._value = Math.min(maxValue, Math.max(minValue, value));
        this._minValue = minValue;
        this._maxValue = maxValue;

        this.target = target;
        this.action = action;

        this._trackDOM = document.createElement("div");
        this._trackDOM.classList.add("hi-slider-track");
        this.dom.appendChild(this._trackDOM);

        this._knobDOM = document.createElement("div");
        this._knobDOM.classList.add("hi-slider-knob");
        this.dom.appendChild(this._knobDOM);

        this._mouseDrag = null;

        this._updateKnobPosition();
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-slider");
        return dom;
    }

    public get value(): number {
        return this._value;
    }

    public set value(value: number) {
        if (this._value === value) {return;}
        this._value = Math.min(this._maxValue, Math.max(this._minValue, value));
        this._updateKnobPosition();
    }

    public get minValue(): number {
        return this._minValue;
    }

    public set minValue(minValue: number) {
        if (this._minValue === minValue) {return;}
        this._minValue = minValue;
        this._updateKnobPosition();
    }

    public get maxValue(): number {
        return this._maxValue;
    }

    public set maxValue(maxValue: number) {
        if (this._maxValue === maxValue) {return;}
        this._maxValue = maxValue;
        this._updateKnobPosition();
    }

    private _updateKnobPosition() {
        let progress = (this._value - this._minValue) / (this._maxValue - this._minValue);
        if (!Number.isFinite(progress)) {progress = 0;}
        this.dom.style.setProperty("--percentage", progress * 100 + "%");
        this.dom.style.setProperty("--progress", progress.toString());
        this.noteFocusRingChanged();
    }

    private _updateValue(event: HIEvent<MouseEvent>): void {
        let {minX, maxX} = this._mouseDrag!;
        let progress = (event.native.clientX - minX) / (maxX - minX);

        if (!Number.isFinite(progress)) {progress = 0;}
        else {progress = Math.min(1, Math.max(0, progress));}

        this._value = this._minValue + progress * (this._maxValue - this._minValue);
        this._updateKnobPosition();
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDown(event);
        }

        let onKnob = event.native.target === this._knobDOM;

        let bounds = this._trackDOM.getBoundingClientRect();
        let knobSize = this._knobDOM.getBoundingClientRect();
        let minX = bounds.x + knobSize.width / 2;
        let maxX = bounds.x + bounds.width - knobSize.width / 2;;

        HISetDOMHasAttribute(this._knobDOM, "highlighted", true);
        this._mouseDrag = {minX, maxX, once: false};
        if (onKnob) {
            let downAt = event.native.clientX;
            let eccentric = (knobSize.x + knobSize.width / 2) - downAt;
            this._mouseDrag.minX -= eccentric;
            this._mouseDrag.maxX -= eccentric;
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

        HISetDOMHasAttribute(this._knobDOM, "highlighted", false);
        if (!this._mouseDrag.once) {return;}

        this._updateValue(event);
        this._mouseDrag = null;

        if (this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override keyDown(event: HIEvent<KeyboardEvent>): void {
        let value = this._value;
        switch (event.native.key) {
        case "ArrowLeft":
        case "ArrowDown":
            value -= 0.05 * (this._maxValue - this._minValue); break;
        case "ArrowRight":
        case "ArrowUp":
            value += 0.05 * (this._maxValue - this._minValue); break;
        default:
            return super.keyDown(event);
        }

        value = Math.min(this._maxValue, Math.max(this._minValue, value));
        this._value = value;
        this._updateKnobPosition();

        if (this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override get keyDOM(): HTMLElement {
        return this._knobDOM;
    }
}
