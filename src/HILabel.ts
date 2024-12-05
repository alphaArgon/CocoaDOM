/*
 *  HILabel.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/28.
 *  Copyright © 2024 alphaArgon.
 */

import { HIColor } from "./HIColor.js";
import { HISetDOMHasAttribute, HISetDOMAlignment } from "./_HIUtils.js";
import { HIView } from "./HIView.js";


export const enum HITextAlignment {
    natural, left, right, center, justified
}


export class HILabel extends HIView {

    private _textNode: Text;
    private _textColor: HIColor;
    private _alignment: HITextAlignment;

    private _selectable: boolean;

    public constructor(text: string = "") {
        super();

        this._textNode = document.createTextNode(text);
        this._textNode.textContent = text;
        this.dom.appendChild(this._textNode);

        this._textColor = HIColor.label;
        this.dom.style.color = this._textColor.cssUsage();

        this._alignment = HITextAlignment.natural;
        this._selectable = false;
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-label");
        return dom;
    }

    public get string(): string {
        return this._textNode.textContent || "";
    }

    public set string(string: string) {
        this._textNode.textContent = string;
    }

    public get textColor(): HIColor {
        return this._textColor;
    }

    public set textColor(color: HIColor) {
        this._textColor = color;
        this.dom.style.color = color.cssUsage();
    }

    public get alignment(): HITextAlignment {
        return this._alignment;
    }

    public set alignment(alignment: HITextAlignment) {
        this._alignment = alignment;
        HISetDOMAlignment(this.dom, alignment);
    }

    public get font(): string {
        return this.dom.style.font || "";
    }

    public set font(font: string) {
        this.dom.style.font = font;
    }

    public get isSelectable(): boolean {
        return this._selectable;
    }

    public set isSelectable(selectable: boolean) {
        this._selectable = selectable;
        HISetDOMHasAttribute(this.dom, "selectable", selectable);
    }
}
