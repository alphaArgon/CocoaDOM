/*
 *  HIButton.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/17.
 *  Copyright © 2024 alphaArgon.
 */

import { HIImage } from "./HIImage.js";
import { HIControl, HIControlState } from "./HIControl.js";
import { HIButtonType, HIButtonStyle, HIImagePosition, HIButtonCell } from "./HIButtonCell.js";
import type { HIView } from "./HIView.js";
import type { HITextAlignment } from "./HILabel.js";
import type { HIEvent, HISelector } from "./HIResponder.js";


export { HIButtonType, HIButtonStyle, HIImagePosition };


export class HIButton extends HIControl {

    private _cell: HIButtonCell;
    private _allowsMixedState: boolean;

    public constructor(title: string, target: Nullable<{}>, action: Nullable<HISelector>);
    public constructor(image: HIImage, target: Nullable<{}>, action: Nullable<HISelector>);
    public constructor(title: string, image: Nullable<{}>, target: Nullable<{}>, action: Nullable<HISelector>);
    public constructor(arg1: any, arg2: any, arg3: any, arg4?: any, type: HIButtonType = HIButtonType.momentary) {
        super();

        let title: Nullable<string>;
        let image: Nullable<HIImage>;

        if (arg1 instanceof HIImage) {
            title = null;
            image = arg1;
            this.target = arg2;
            this.action = arg3;
        } else if (arg2 instanceof HIImage || arg4 !== undefined) {
            title = arg1;
            image = arg2;
            this.target = arg3;
            this.action = arg4;
        } else {
            title = arg1;
            image = null;
            this.target = arg2;
            this.action = arg3;
        }

        this._cell = new.target.makeCell();
        this._cell.controlView = this;
        this._cell.type = type;
        if (title) {this._cell.title = title;}
        if (image) {this._cell.image = image;}
        this.dom.appendChild(this._cell.dom);

        this._allowsMixedState = false;
    }

    public static checkbox(title: string, target: Nullable<{}>, action: Nullable<HISelector>): HIButton {
        return new (HIButton as any)(title, null, target, action, HIButtonType.check);
    }

    public static radioButton(title: string, target: Nullable<{}>, action: Nullable<HISelector>): HIButton {
        return new (HIButton as any)(title, null, target, action, HIButtonType.radio);
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("span");
        dom.classList.add("hi-button");
        return dom;
    }

    protected static makeCell(): HIButtonCell {
        return new HIButtonCell();
    }

    public get cell(): HIButtonCell {
        return this._cell;
    }

    public get title(): string {
        return this._cell.title;
    }

    public set title(title: string) {
        this._cell.title = title;
    }

    public get image(): Nullable<HIImage> {
        return this._cell.image;
    }

    public set image(image: Nullable<HIImage>) {
        this._cell.image = image;
    }

    public get imagePosition(): HIImagePosition {
        return this._cell.imagePosition;
    }

    public set imagePosition(position: HIImagePosition) {
        this._cell.imagePosition = position;
    }

    public get imageHugsTitle(): boolean {
        return this._cell.imageHugsTitle;
    }

    public set imageHugsTitle(hugs: boolean) {
        this._cell.imageHugsTitle = hugs;
    }

    public get alignment(): HITextAlignment {
        return this._cell.alignment;
    }

    public set alignment(alignment: HITextAlignment) {
        this._cell.alignment = alignment;
    }

    public get state(): HIControlState {
        return this._cell.state;
    }

    public set state(state: HIControlState) {
        this._cell.state = state;
    }

    public get type(): HIButtonType {
        return this._cell.type;
    }

    public set type(type: HIButtonType) {
        this._cell.type = type;
    }

    public get style(): HIButtonStyle {
        return this._cell.style;
    }

    public set style(style: HIButtonStyle) {
        this._cell.style = style;
    }

    public override get keyDOM(): HTMLElement {
        return this._cell.keyDOM;
    }

    public get allowsMixedState(): boolean {
        return this._allowsMixedState;
    }

    public set allowsMixedState(allows: boolean) {
        this._allowsMixedState = allows;
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDown(event);
        }

        this._cell.isHighlighted = true;
    }

    public override mouseDragged(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseDragged(event);
        }

        this._cell.isHighlighted = event.isMouseInDOM(this.dom);
    }

    public override mouseUp(event: HIEvent<MouseEvent>): void {
        if (!this.isEnabled) {
            return super.mouseUp(event);
        }

        this._cell.isHighlighted = false;
        if (event.isMouseInDOM(this.dom)) {
            this._performAction();
        }
    }

    public override keyDown(event: HIEvent<KeyboardEvent>): void {
        if (this.isEnabled && event.native.key === " ") {
            this.performClick();

        } else if (this._cell.type === HIButtonType.radio && this.superview !== null) {
            let index: number;

            switch (event.native.key) {
            case "ArrowUp":
            case "ArrowLeft":
                index = this.superview.subviews.indexOf(this);
                while (index > 0) {
                    index -= 1;
                    let view = this.superview.subviews[index];
                    if (this._isViewInSameRadioGroup(view)) {
                        return view.performClick();
                    }
                }
                break;

            case "ArrowDown":
            case "ArrowRight":
                index = this.superview.subviews.indexOf(this);
                while (index < this.superview.subviews.length - 1) {
                    index += 1;
                    let view = this.superview.subviews[index];
                    if (this._isViewInSameRadioGroup(view)) {
                        return view.performClick();
                    }
                }
                break;

            default: break;
            }

            super.keyDown(event);

        } else {
            super.keyDown(event);
        }
    }

    public override performClick(sender?: any): void {
        if (!this.isEnabled) {return;}

        this._cell.isHighlighted = true;
        this._performAction();

        let oldTimeout = this.dom.dataset.highlightTimeout;
        if (oldTimeout !== undefined) {
            clearTimeout(parseInt(oldTimeout));
        }

        this.dom.dataset.highlightTimeout = setTimeout(() => {
            this._cell.isHighlighted = false;
        }, 100).toString();
    }

    private _performAction(): void {
        switch (this._cell.type) {
        case HIButtonType.momentary:
            break;

        case HIButtonType.onOff:
        case HIButtonType.check:
            switch (this._cell.state) {
            case HIControlState.mixed:
                this._cell.state = HIControlState.on; break;
            case HIControlState.off:
                this._cell.state = this._allowsMixedState ? HIControlState.mixed : HIControlState.on; break;
            case HIControlState.on:
                this._cell.state = HIControlState.off; break;
            }
            break;

        case HIButtonType.radio:
            this._cell.state = HIControlState.on;

            if (this.superview !== null)
            for (let subview of this.superview.subviews) {
                if (subview !== this && this._isViewInSameRadioGroup(subview)) {
                    subview._cell.state = HIControlState.off;

                    if (subview.window?.firstResponder === subview) {
                        subview.window!.makeFirstResponder(this);
                    }
                }
            }

            break;
        }

        if (this.action !== null) {
            this.sendAction(this.action, this.target);
        }
    }

    public override get canBecomeKeyView(): boolean {
        let can = super.canBecomeKeyView;
        if (!can) {return false;}
        if (this._cell.type !== HIButtonType.radio) {return true;}
        if (this._cell.state !== HIControlState.off) {return true;}

        //  Check whether the radio group has any selected button. If has, return false.
        //  If not, return whether the receiver is the first button in the radio group.
        if (this.superview === null) {return true;}

        let first = false;
        let hasOn = false;

        let firstRadio = true;
        for (let subview of this.superview.subviews) {
            if (this._isViewInSameRadioGroup(subview)) {
                if (firstRadio) {
                    first = subview === this;
                } else {
                    firstRadio = false;
                }

                hasOn ||= subview._cell.state !== HIControlState.off;
            }
        }

        return !hasOn && first;
    }

    private _isViewInSameRadioGroup(view: HIView): view is HIButton {
        if (!(view instanceof HIButton)) {return false;}
        if (!view.isEnabled) {return false;}
        if (view._cell.type !== HIButtonType.radio) {return false;}
        if (view.action !== this.action) {return false;}
        return true;
    }
}
