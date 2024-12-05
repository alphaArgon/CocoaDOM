/*
 *  HIPopUpButtonCell.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/18.
 *  Copyright © 2024 alphaArgon.
 */

import { HIButtonCell } from "./HIButtonCell.js";


export class HIPopUpButtonCell extends HIButtonCell {

    private _arrowDOM: HTMLElement;
    private _pullsDown: boolean;

    public constructor() {
        super();
        this.dom.classList.add("hi-pop-up-button-cell");
        this.dom.children[0].classList.add("hi-pop-up-button-bezel");

        this._arrowDOM = document.createElement("span");
        this._arrowDOM.classList.add("hi-pop-up-button-arrow");
        this.dom.appendChild(this._arrowDOM);

        this._pullsDown = false;
        this._arrowDOM.innerHTML = HIPopUpArrowsSVG;

        this.alignment = 0;
    }

    public get pullsDown(): boolean {
        return this._pullsDown;
    }

    public set pullsDown(pullsDown: boolean) {
        if (pullsDown === this._pullsDown) {return;}
        this._pullsDown = pullsDown;
        this._arrowDOM.innerHTML = pullsDown ? HIPullDownArrowSVG : HIPopUpArrowsSVG;
    }
}


const HIPopUpArrowsSVG = `<svg viewBox="0 0 16 19" class="hi-pop-up-button-arrow-glyph" xmlns="http://www.w3.org/2000/svg"><path d="M5.15 11.65l3.1 3.1 3.1-3.1m-6.2-4.3l3.1-3.1 3.1 3.05" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" fill="none"/></svg>`;
const HIPullDownArrowSVG = `<svg viewBox="0 0 16 19" class="hi-pop-up-button-arrow-glyph" xmlns="http://www.w3.org/2000/svg"><path d="M5.15 8.05l3.1 3.1 3.1-3.1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" fill="none"/></svg>`;
