/*
 *  HIButtonCell.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/17.
 *  Copyright © 2024 alphaArgon.
 */

import { HICell } from "./HICell.js";
import { HIControlState } from "./HIControl.js";
import { HIImage } from "./HIImage.js";
import { HISetDOMAlignment, HISetDOMHasAttribute, HISetDOMState } from "./_HIUtils.js";
import type { HITextAlignment } from "./HILabel.js";


export const enum HIButtonType {
    momentary, onOff, check, radio,
}

export const enum HIButtonStyle {
    rounded, texturedRounded, 
}

export const enum HIImagePosition {
    leading, trailing, 
}


export class HIButtonCell extends HICell {

    //  Bezel is not applied to the cell DOM directly, but has an exclusive child.
    //  The reason is that the rounded button needs two layers to implement the texture.
    private _bezelDOM: HTMLElement;
    private _titleDOM: Nullable<HTMLElement>;
    private _imageDOM: Nullable<HTMLElement>;

    //  The state glyphs that are added to the bezel.
    //  We assume that an off checkbox is unlikely to be checked, and an on checkbox is unlikely to
    //  be set to mixed. Therefore, only add the state glyphs when needed.
    //  0: none, 1: check/dot, 2: check/dot + bar
    private _checkRadioStateGlyphs: number;
    private _checkRadioTimer: number;

    //  A cache to whether the type is `check` or `radio`.
    private _checkRadio: boolean;

    private _image: Nullable<HIImage>;
    private _imagePosition: HIImagePosition;
    private _alignment: HITextAlignment;

    private _state: HIControlState;
    private _type: HIButtonType;
    private _style: HIButtonStyle;
    private _highlighted: boolean;

    public constructor() {
        super(document.createElement("span"));
        this.dom.classList.add("hi-button-cell");

        this._bezelDOM = document.createElement("span");
        this._bezelDOM.classList.add("hi-button-bezel");
        this.dom.appendChild(this._bezelDOM);

        this._titleDOM = null;
        this._imageDOM = null;

        this._checkRadioStateGlyphs = 0;
        this._checkRadioTimer = 0;
        this._checkRadio = false;

        this._image = null;
        this._imagePosition = HIImagePosition.leading;
        this._alignment = 3;  //  Default to center.
        HISetDOMAlignment(this.dom, this._alignment);

        this._state = HIControlState.off;
        this._highlighted = false;

        this._style = -1 as HIButtonStyle;
        this._type = -1 as HIButtonType;
        this._setStyleAndType(HIButtonStyle.rounded, HIButtonType.momentary);
    }

    public get keyDOM(): HTMLElement {
        return this._bezelDOM;
    }

    public get title(): string {
        return this._titleDOM?.textContent || "";
    }

    public set title(title: string) {
        if (!title) {
            if (this._titleDOM !== null) {
                this._titleDOM.remove();
                this._titleDOM = null;
            }

            this._moveTitleImageToPlace();
            return;
        }

        if (this._titleDOM === null) {
            this._titleDOM = document.createElement("span");
            this._titleDOM.classList.add("hi-button-title");
            this._moveTitleImageToPlace();
        }

        this._titleDOM.textContent = title;
    }

    public get image(): Nullable<HIImage> {
        return this._image;
    }

    public set image(image: Nullable<HIImage>) {
        if (image === this._image) {return;}
        this._image = image;

        if (this._checkRadio) {return;}
        this._applyImage(image);
    }

    private _applyImage(image: Nullable<HIImage>) {
        if (image === null) {
            if (this._imageDOM !== null) {
                this._imageDOM.remove();
                this._titleDOM = null;
            }

            this._moveTitleImageToPlace();
            return;
        }

        let newDOM = image.makeDOM();
        newDOM.classList.add("hi-button-image");

        if (this._imageDOM === null) {
            this._imageDOM = newDOM;
            this._moveTitleImageToPlace();
        } else {
            this._imageDOM.replaceWith(newDOM);
            this._imageDOM = newDOM;
        }

        this._moveTitleImageToPlace();
    }

    public get imagePosition(): HIImagePosition {
        return this._imagePosition;
    }

    public set imagePosition(position: HIImagePosition) {
        if (position === this._imagePosition) {return;}
        this._imagePosition = position;

        if (this._imageDOM === null) {return;}
        this._moveTitleImageToPlace();
    }

    public get imageHugsTitle(): boolean {
        return this.dom.classList.contains("image-hugs-title");
    }

    public set imageHugsTitle(hugs: boolean) {
        this.dom.classList.toggle("image-hugs-title", hugs);
    }

    public get alignment(): HITextAlignment {
        return this._alignment;
    }

    public set alignment(alignment: HITextAlignment) {
        this._alignment = alignment;
        HISetDOMAlignment(this.dom, alignment);
    }

    public get state(): HIControlState {
        return this._state;
    }

    public set state(state: HIControlState) {
        if (state === this._state) {return;}
        this._state = state;

        if (this._checkRadio) {
            this._addCheckRadioStateGlyph();
            this._startCheckRadioAnimation();
        }

        HISetDOMState(this.dom, state);
        HISetDOMState(this._bezelDOM, state);
    }

    private _addCheckRadioStateGlyph() {
        switch (this._state) {
        case HIControlState.off:
            return;
        case HIControlState.on:
            if (this._checkRadioStateGlyphs >= 1) {return;}
            this._bezelDOM.innerHTML = this._type === HIButtonType.check ? _HICheckSVG : _HIDotSVG;
            this._checkRadioStateGlyphs = 1;
            break;
        case HIControlState.mixed:
            if (this._checkRadioStateGlyphs >= 2) {return;}
            this._bezelDOM.innerHTML = (this._type === HIButtonType.check ? _HICheckSVG : _HIDotSVG) + _HIBarSVG;
            this._checkRadioStateGlyphs = 2;
            break;
        }
    }

    private _startCheckRadioAnimation() {
        if (this.controlView?.window?.isKeyWindow !== true) {return;}

        if (this._checkRadioTimer) {
            clearTimeout(this._checkRadioTimer);
        }

        this._bezelDOM.classList.add("animated");
        this._bezelDOM.offsetHeight;  //  Force reflow
        this._checkRadioTimer = setTimeout(() => {
            this._bezelDOM.classList.remove("animated");
            this._checkRadioTimer = 0;
        }, 400);
    }

    private _cancelCheckRadioAnimation() {
        if (this._checkRadioTimer) {
            clearTimeout(this._checkRadioTimer);
            this._bezelDOM.classList.remove("animated");
            this._checkRadioTimer = 0;
        }
    }

    public get isEnabled(): boolean {
        return !this.dom.hasAttribute("disabled");
    }

    public set isEnabled(enabled: boolean) {
        this._cancelCheckRadioAnimation();
        HISetDOMHasAttribute(this.dom, "disabled", !enabled);
        HISetDOMHasAttribute(this._bezelDOM, "disabled", !enabled);
    }

    public get isHighlighted(): boolean {
        return this._highlighted;
    }

    public set isHighlighted(highlighted: boolean) {
        if (highlighted === this._highlighted) {return;}
        this._highlighted = highlighted;

        if (this._checkRadio) {
            this._startCheckRadioAnimation();
        }

        HISetDOMHasAttribute(this.dom, "highlighted", highlighted);
        HISetDOMHasAttribute(this._bezelDOM, "highlighted", highlighted);
    }

    public get style(): HIButtonStyle {
        return this._style;
    }

    public set style(style: HIButtonStyle) {
        if (style === this._style) {return;}
        this._setStyleAndType(style, this._type);
    }

    public get type(): HIButtonType {
        return this._type;
    }

    public set type(type: HIButtonType) {
        if (type === this._type) {return;}
        this._setStyleAndType(this._style, type);
    }

    private _setStyleAndType(style: HIButtonStyle, type: HIButtonType): void {
        this._style = style;
        this._type = type;

        this._cancelCheckRadioAnimation();
        this.dom.classList.remove("rounded", "textured-rounded");

        this._bezelDOM.innerHTML = "";
        this._bezelDOM.classList.remove("rounded", "textured-rounded", "check", "radio");

        if (type === HIButtonType.check || type === HIButtonType.radio) {
            this._checkRadio = true;
            this._checkRadioStateGlyphs = 0;
            this._addCheckRadioStateGlyph();
            this._bezelDOM.classList.add(type === HIButtonType.check ? "check" : "radio");

            this._alignment = 0;  //  Default to leading.
            HISetDOMAlignment(this.dom, 0);

            this._applyImage(null);

        } else {
            this._checkRadio = false;

            switch (style) {
            case HIButtonStyle.rounded:
                this.dom.classList.add("rounded");
                this._bezelDOM.classList.add("rounded"); break;
            case HIButtonStyle.texturedRounded:
                this.dom.classList.add("textured-rounded");
                this._bezelDOM.classList.add("textured-rounded"); break;
            }

            this._applyImage(this._image);
        }
    }

    private _moveTitleImageToPlace(): void {
        let doms: Nullable<HTMLElement>[];
        switch (this._imagePosition) {
        case HIImagePosition.leading: doms = [this._imageDOM, this._titleDOM]; break;
        case HIImagePosition.trailing: doms = [this._titleDOM, this._imageDOM]; break;
        }

        let first = true;
        let prev = this._bezelDOM;
        for (let dom of doms) {
            if (dom === null) {continue;}
            prev.after(dom);
            prev = dom;

            dom.classList.toggle("hi-button-content-head", first);
            dom.classList.remove("hi-button-content-tail");
            first = false;
        }

        if (prev !== this._bezelDOM) {
            prev.classList.add("hi-button-content-tail");
        }
    }
}


const _HICheckSVG = `<svg viewBox="0 0 14 14" class="hi-button-state-glyph on" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3.75 7.75L6 10.25l4.25-6.5"/></svg>`;
const _HIBarSVG = `<svg viewBox="0 0 14 14" class="hi-button-state-glyph mixed" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h6"/></svg>`;
const _HIDotSVG = `<svg viewBox="0 0 14 14" class="hi-button-state-glyph on" xmlns="http://www.w3.org/2000/svg"><circle fill="currentColor" cx="7" cy="7" r="2.75"/></svg>`;
