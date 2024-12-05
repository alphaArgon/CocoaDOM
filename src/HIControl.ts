/*
 *  HIControl.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/16.
 *  Copyright © 2024 alphaArgon.
 */

import { HIView } from "./HIView.js";
import type { HIEvent, HISelector } from "./HIResponder.js";


export const enum HIControlState {
    mixed = -1,
    off = 0,
    on = 1
}


export class HIControl extends HIView {

    private _tag: number = 0;
    private _target: Nullable<{}> = null;
    private _action: Nullable<HISelector> = null;
    private _enabled: boolean = true;
    private _continuous: boolean = false;

    public override get tag(): number {
        return this._tag;
    }

    public override set tag(tag: number) {
        this._tag = tag;
    }

    public get target(): Nullable<{}> {
        return this._target;
    }

    public set target(target: Nullable<{}>) {
        this._target = target;
    }

    public get action(): Nullable<HISelector> {
        return this._action;
    }

    public set action(action: Nullable<HISelector>) {
        this._action = action;
    }

    public get isEnabled(): boolean {
        return this._enabled;
    }

    public set isEnabled(enabled: boolean) {
        this._enabled = enabled;
    }

    public get isContinuous(): boolean {
        return this._continuous;
    }

    public set isContinuous(continuous: boolean) {
        this._continuous = continuous;
    }

    public override get acceptsFirstResponder(): boolean {
        return this._enabled;
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return this.isEnabled;
    }

    public override get needsPanelToBecomeKey(): boolean {
        return false;
    }

    public performClick(sender?: any): void {
        if (!this._enabled) {return;}
        if (this._action !== null) {
            this.window?.sendAction(this._action, this._target, this);
        }
    }

    public sendAction(action: HISelector, toTarget: Nullable<{}>): void {
        this.window?.sendAction(action, toTarget, this);
    }

    public override get allowsFocusRing(): boolean {
        return true;
    }
}
