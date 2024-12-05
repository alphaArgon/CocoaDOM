/*
 *  HIDrawingView.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/5.
 *  Copyright © 2024 alphaArgon.
 */

import { HIView } from "./HIView.js";
import { HIRect, HIRectUnion } from "./HIGeometry.js";
import { _HIAlignScanRect } from "./_HISharedLayout.js";


//  Safari always keeps the canvas even there’s no other reference to it. Is it kinda memory leak?
//  So we use a pool to reuse the canvas.
const _HIDrawingViewCanvasDOMPool: HTMLCanvasElement[] = [];


export class HIDrawingView extends HIView {

    private _dirtyRect: Nullable<HIRect>;  //  null means whole view
    private _canvasDOM: Nullable<HTMLCanvasElement>;
    private _canvasScale: number;

    public constructor() {
        super();
        this._dirtyRect = null;
        this._canvasDOM = null;
        this._canvasScale = 1;
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-drawing-view");
        return dom;
    }

    public override setNeedsDisplay(inRect?: Readonly<HIRect>): void {
        if (inRect !== undefined && this._dirtyRect !== null) {
            this._dirtyRect = HIRectUnion(this._dirtyRect, inRect);
        } else if (inRect !== undefined) {
            this._dirtyRect = inRect;
        } else {
            this._dirtyRect = null;
        }

        super.setNeedsDisplay();
    }

    public override display(): void {
        let dirtyRect = this._dirtyRect;
        if (dirtyRect === null) {dirtyRect = this.bounds;}
        dirtyRect = _HIAlignScanRect(dirtyRect);

        let context = this._canvasDOM!.getContext("2d")!;
        context.save();
        context.scale(this._canvasScale, this._canvasScale);

        if (!this.isOpaque) {
            context.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
        }

        if (this._dirtyRect !== null) {
            context.beginPath();
            context.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
            context.clip();
        }

        this.drawRect(dirtyRect, context);
        context.restore();
    }

    public override layout(): void {
        let {width, height} = this.bounds;
        this._canvasScale = window.devicePixelRatio;
        
        if (this._canvasDOM !== null) {
            this._canvasDOM.width = width * this._canvasScale;
            this._canvasDOM.height = height * this._canvasScale;
        }
    }

    public override willUnhide(): void {
        let canvas = _HIDrawingViewCanvasDOMPool.pop();
        if (canvas === undefined) {
            canvas = document.createElement("canvas");
            canvas.classList.add("hi-drawing-view-canvas");
        }

        this._canvasDOM = canvas;
        this.dom.prepend(canvas);
        this.setNeedsLayout();
    }

    public override willHide(): void {
        _HIDrawingViewCanvasDOMPool.push(this._canvasDOM!);
        this._canvasDOM!.remove();
        this._canvasDOM = null;
    }

    /** Returns the bounding box of the view relative to the view itself. */
    public get bounds(): Readonly<HIRect> {
        let {width, height} = this.dom.getBoundingClientRect();
        return {x: 0, y: 0, width, height};
    }

    /** Overridden by subclasses to draw the view’s contents into the specified rectangle.
      * 
      * The passed rectangle is relative to the view itself. */
    public drawRect(rect: Readonly<HIRect>, context: CanvasRenderingContext2D): void {}

    /** Overridden by subclasses to return whether the view is fully opaque.
      * 
      * The default implementation returns `false`. */
    public get isOpaque(): boolean {
        return false;
    }
}
