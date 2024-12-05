/*
 *  _HISharedLayout.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/1.
 *  Copyright © 2024 alphaArgon.
 */

import { HIObservable } from "./HIObservable.js";
import type { HISelector } from "./HIResponder.js";
import type { HIEdgeInsets, HIRect, HISize } from "./HIGeometry.js";


const _HIZeroEdgeInsets: HIEdgeInsets = {minX: 0, minY: 0, maxX: 0, maxY: 0};

export class _HIContentInsets extends HIObservable<HIEdgeInsets, {
    contentInsetsDidChange(insets: HIEdgeInsets, key: keyof HIEdgeInsets, newValue: number): void;
}> {

    public constructor() {
        super(_HIZeroEdgeInsets);
    }

    public static override get observerAction(): HISelector {
        return "contentInsetsDidChange";
    }

    public static override get observedKeys(): readonly string[] {
        return ["minX", "minY", "maxX", "maxY"];
    }
}


export class _HICheckedSize implements HISize {

    private _width: number;
    private _height: number;

    public constructor(width: number, height: number) {
        this._width = _HIAlignScanCoord(width);
        this._height = _HIAlignScanCoord(height);
    }

    public get width(): number {
        return this._width;
    }

    public set width(width: number) {
        this._width = _HIAlignScanCoord(width);
    }

    public get height(): number {
        return this._height;
    }

    public set height(height: number) {
        this._height = _HIAlignScanCoord(height);
    }
}


/** Rounds the coordinate to the nearest subpixel. */
export function _HIAlignScanCoord(coordinate: number): number {
    if (!Number.isFinite(coordinate)) {return 0;}
    let scale = window.devicePixelRatio;
    return Math.round(coordinate * scale) / scale;
}

/** Rounds the size up to the nearest subpixel. */
export function _HIAlignScanSize(size: Readonly<HISize>): HISize {
    let {width, height} = size;
    let scale = window.devicePixelRatio;

    if (!Number.isFinite(width)) {width = 0;}
    else {width = Math.ceil(width * scale) / scale;}

    if (!Number.isFinite(height)) {height = 0;}
    else {height = Math.ceil(height * scale) / scale;}

    return {width, height};
}

/** Rounds the rect outwards to the nearest subpixel. */
export function _HIAlignScanRect(rect: Readonly<HIRect>): HIRect {
    let {x: minX, y: minY, width, height} = rect;
    let scale = window.devicePixelRatio;

    let maxX = minX + width;
    let maxY = minY + height;

    if (!Number.isFinite(minX)) {minX = 0;}
    else {minX = Math.floor(minX * scale) / scale;}

    if (!Number.isFinite(minY)) {minY = 0;}
    else {minY = Math.floor(minY * scale) / scale;}

    if (!Number.isFinite(maxX)) {maxX = 0;}
    else {maxX = Math.ceil(maxX * scale) / scale;}

    if (!Number.isFinite(maxY)) {maxY = 0;}
    else {maxY = Math.ceil(maxY * scale) / scale;}

    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
}

let _HISizeMeasurerBox: Nullable<HTMLElement> = null;


/** Measures the size of the given DOM element, assuming it has no external constraints.
  * 
  * The size passed to the callback is rounded up to the nearest subpixel. */
export function _HIWithFreeSizeOfDOM<T>(dom: HTMLElement, body: (size: HISize) => T): T {
    if (_HISizeMeasurerBox === null) {
        let superbox = document.createElement("div");
        superbox.style.position = "absolute";
        superbox.style.visibility = "hidden";
        superbox.style.overflow = "hidden";
        superbox.style.width = "1px";
        superbox.style.height = "1px";
        document.body.appendChild(superbox);

        _HISizeMeasurerBox = document.createElement("div");
        _HISizeMeasurerBox.style.width = "10000px";
        _HISizeMeasurerBox.style.height = "10000px";
        _HISizeMeasurerBox.style.position = "relative";
        superbox.append(_HISizeMeasurerBox);
    }

    let oldPosition = dom.style.position;
    let parent = dom.parentNode;
    let sibling = dom.nextSibling;

    _HISizeMeasurerBox.appendChild(dom);
    dom.style.position = "absolute";

    let rect = dom.getBoundingClientRect();
    let result = body(_HIAlignScanSize(rect));

    dom.style.position = oldPosition;
    _HISizeMeasurerBox.removeChild(dom);

    if (parent !== null) {
        parent.insertBefore(dom, sibling);
    }

    return result;
}
