/*
 *  HIAnimator.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/21.
 *  Copyright © 2024 alphaArgon.
 */

import type { HIPoint, HIRect } from "./HIGeometry.js";


export type HITimingFunction = (progress: number) => number;


export class HIAnimator {

    private _duration: number;
    private _delay: number;
    private _startTime: number;
    private _progress: number;
    private _timingFunction: HITimingFunction;
    private _action: (animator: HIAnimator) => void;
    private _finishedCallbacks: (() => void)[];
    private _cancelledCallbacks: (() => void)[];

    private _delayTimer: number;

    private constructor(duration: number, delay: number, timingFunction:HITimingFunction, action: (animator: HIAnimator) => void) {
        this._duration = duration;
        this._delay = Math.max(delay, 0);
        this._startTime = -1;
        this._progress = 0;
        this._timingFunction = timingFunction;
        this._action = action;
        this._finishedCallbacks = [];
        this._cancelledCallbacks = [];
        this._delayTimer = 0;
    }

    private static _sinusoidal(progress: number): number {
        return 0.5 - 0.5 * Math.cos(progress * Math.PI);
    }

    public static frameByFrame(duration: number, action: (animator: HIAnimator) => void): HIAnimator;
    public static frameByFrame(duration: number, delay: number, action: (animator: HIAnimator) => void): HIAnimator;
    public static frameByFrame(duration: number, timingFunction: HITimingFunction, action: (animator: HIAnimator) => void): HIAnimator;
    public static frameByFrame(duration: number, delay: number, timingFunction: HITimingFunction, action: (animator: HIAnimator) => void): HIAnimator;
    public static frameByFrame(duration: number, arg1: any, arg2?: any, arg3?: any): HIAnimator {
        switch (undefined) {
        case arg2: return new HIAnimator(duration, 0, HIAnimator._sinusoidal, arg1);
        case arg3: return new HIAnimator(duration, arg1, HIAnimator._sinusoidal, arg2);
        default: return new HIAnimator(duration, arg1, arg2, arg3);
        }
    }

    public then(callback: () => void): this {
        this._finishedCallbacks.push(callback);
        return this;
    }

    public catch(callback: () => void): this {
        this._cancelledCallbacks.push(callback);
        return this;
    }

    public thenOrCatch(callback: () => void): this {
        this._finishedCallbacks.push(callback);
        this._cancelledCallbacks.push(callback);
        return this;
    }

    public play(): this {
        if (this._startTime >= 0) {return this;}
        if (this._delayTimer !== 0) {return this;}

        if (this._delay === 0) {
            this._startTime = performance.now();
            this._progress = 0;
            this._update();

        } else {
            this._delayTimer = setTimeout(() => {
                this._delayTimer = 0;
                this._startTime = performance.now();
                this._progress = 0;
                this._update();
            }, this._delay);
        }

        return this;
    }

    public cancel(): void {
        if (this._startTime < 0 && this._delayTimer === 0) {return;}

        clearTimeout(this._delayTimer);
        this._delayTimer = 0;
        this._startTime = -1;
        this._progress = 0;

        for (let callback of this._cancelledCallbacks) {
            callback();
        }
    }

    public get isAnimating(): boolean {
        return this._startTime >= 0;
    }

    public get progress(): number {
        return this._progress;
    }

    public get value(): number {
        return this._timingFunction(this._progress);
    }

    private _update(): void {
        if (this._startTime < 0) {return;}
        this._progress = Math.min((performance.now() - this._startTime) / this._duration, 1);

        try {
            this._action(this);
        } catch (error) {
            this.cancel();
            throw error;
        }

        if (this._progress < 1) {
            requestAnimationFrame(() => this._update());
        } else {
            this._startTime = -1;
            this._progress = 0;

            for (let callback of this._finishedCallbacks) {
                callback();
            }
        }
    }
}


export class HIPointInterpolation {

    private _x: number;
    private _y: number;

    private _dx: number;
    private _dy: number;

    public constructor(from: HIPoint, to: HIPoint) {
        this._x = from.x;
        this._y = from.y;
        this._dx = to.x - from.x;
        this._dy = to.y - from.y;
    }

    public pointAt(factor: number, round: number | boolean = false): HIPoint {
        let x = this._x + this._dx * factor;
        let y = this._y + this._dy * factor;

        if (round) {
            round = +round;
            x = Math.round(x / round) * round;
            y = Math.round(y / round) * round;
        }

        return {x, y};
    }
}

export class HIRectInterpolation {

    private _x: number;
    private _y: number;
    private _w: number;
    private _h: number;

    private _dx: number;
    private _dy: number;
    private _dw: number;
    private _dh: number;

    public constructor(from: HIRect, to: HIRect) {
        this._x = from.x;
        this._y = from.y;
        this._w = from.width;
        this._h = from.height;
        this._dx = to.x - from.x;
        this._dy = to.y - from.y;
        this._dw = to.width - from.width;
        this._dh = to.height - from.height;
    }

    public rectAt(factor: number): HIRect {
        let x = this._x + this._dx * factor;
        let y = this._y + this._dy * factor;
        let w = this._w + this._dw * factor;
        let h = this._h + this._dh * factor;
        return {x, y, width: w, height: h};
    }
}
