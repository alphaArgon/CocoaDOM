/*
 *  HIImage.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/16.
 *  Copyright © 2024 alphaArgon.
 */


/** A HIImage is a wrapper of an HTMLImageElement that can be placed in the DOM. */
export class HIImage {

    private _templateDOM: HTMLElement;
    private _description: string = "";

    /** Returns a new DOM object that displays the image */
    public makeDOM(): HTMLElement {
        return this._templateDOM.cloneNode(true) as HTMLElement;
    }

    public makeHTML(): string {
        return this._templateDOM.outerHTML;
    }

    public get description(): string {
        return this._description;
    }

    private constructor(templateDOM: HTMLElement) {
        this._templateDOM = templateDOM;
    }

    /** This method is for internal use only. */
    public static _fromTemplateDOM(templateDOM: HTMLElement): HIImage {
        return new HIImage(templateDOM);
    }

    /** A tintable image means the color of the image can be changed by CSS property `color`.
      * That is, the image is used as an alpha mask to apply the color. */
    public static fromPath(src: string, tintable: boolean): HIImage {
        let dom = document.createElement("i");
        dom.classList.add("hi-image");
        dom.classList.toggle("tintable", tintable);

        let img = document.createElement("img");
        img.src = src;
        dom.appendChild(img);

        if (tintable) {
            let fullSrc = img.src.replace('"' , '\\"');
            dom.classList.add("tintable", "masked");
            dom.style.setProperty("--hi-mask-image", `url("${fullSrc}")`);
        }

        return new HIImage(dom);
    }

    private static _symbolFromSVGLines(...lines: string[]): HIImage {
        let dom = document.createElement("i");
        dom.classList.add("hi-image", "symbol", "tintable");
        dom.innerHTML = lines.join("");
        return new HIImage(dom);
    }

    public static symbolFromPath(src: string): HIImage {
        let image = HIImage.fromPath(src, true);
        image._templateDOM.classList.add("symbol");
        return image;
    }

    public static readonly menuStateOn = HIImage._symbolFromSVGLines(
        `<svg class="hi-em-image-entity" viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor">`,
        `<path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M1 6.5L4 10l6-9"/>`,
        `</svg>`
    );

    public static readonly menuStateMixed = HIImage._symbolFromSVGLines(
        `<svg class="hi-em-image-entity" viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor">`,
        `<path stroke-width="2" stroke-linecap="round" d="M2 6.5h9"/>`,
        `</svg>`
    );

    public static readonly menuStateDiamond = HIImage._symbolFromSVGLines(
        `<svg class="hi-em-image-entity" viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor">`,
        `<path stroke-width="1.75" stroke-linejoin="round" d="M6.5 1.5l-4 5 4 5 4-5z"/>`,
        `</svg>`
    );
}
