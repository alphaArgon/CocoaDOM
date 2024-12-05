/*
 *  HIBox.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/27.
 *  Copyright © 2024 alphaArgon.
 */

import { HIView } from "./HIView.js";
import { HIColor } from "./HIColor.js";
import { HIEdgeInsets, HIRect, HISize } from "./HIGeometry.js";
import { HIObservableSetObserver, HIObservableSetValueForKey } from "./HIObservable.js";
import { _HIContentInsets, _HIAlignScanCoord, _HIWithFreeSizeOfDOM } from "./_HISharedLayout.js";


export const enum HIViewAutoresizingMask {
    none        = 0,
    minXMargin  = 1 << 0,
    width       = 1 << 1,
    maxXMargin  = 1 << 2,
    minYMargin  = 1 << 3,
    height      = 1 << 4,
    maxYMargin  = 1 << 5,
}


export type HIViewFrame = HIRect & {
    readonly maxX: number;
    readonly maxY: number;
    autoresizingMask: HIViewAutoresizingMask;
}


export class HIBox extends HIView {

    private _titleDOM: Nullable<HTMLElement>;
    private _contentDOM: HTMLElement;
    private _backgroundColor: HIColor;

    /** Once set to non-null, should not be changed. */
    private _contentSize: Nullable<HISize>;
    private _contentInsets: _HIContentInsets;
    private _subviewFrames: WeakMap<HIView, _HIViewFrame>;

    public constructor() {
        super();

        this._titleDOM = null;
        this._contentDOM = document.createElement("div");
        this._contentDOM.classList.add("hi-box-content");
        this.dom.appendChild(this._contentDOM);

        this._backgroundColor = HIColor.clear;

        this._contentSize = null;

        this._contentInsets = new _HIContentInsets();
        HIObservableSetObserver(this._contentInsets, this);

        this._subviewFrames = new WeakMap();
    }

    protected static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-box");
        return dom;
    }

    public get title(): string {
        return this._titleDOM?.textContent || "";
    }

    public set title(title: string) {
        if (!title) {
            if (this._titleDOM !== null) {this._titleDOM.remove();}
            return;
        }

        if (this._titleDOM === null) {
            this._titleDOM = document.createElement("span");
            this._titleDOM.classList.add("hi-box-title");
        }
        
        if (this._titleDOM.parentElement === null) {
            this._contentDOM.before(this._titleDOM);
        }

        this._titleDOM.textContent = title;
    }

    public get backgroundColor(): HIColor {
        return this._backgroundColor;
    }

    public set backgroundColor(color: HIColor) {
        if (color === this._backgroundColor) {return;}
        this._backgroundColor = color;
        this._contentDOM.style.backgroundColor = color.cssUsage();
    }

    public override willRemoveSubview(subview: HIView): void {
        let frame = this._subviewFrames.get(subview)!;
        this._subviewFrames.delete(subview);
        frame.containerDOM.remove();
    }

    protected override insertDOMOfProposedSubview(subview: HIView, proposedIndex: number): void {
        let frame = this._subviewFrames.get(subview)!;
        if (frame === undefined) {
            frame = new _HIViewFrame(subview);
            this._subviewFrames.set(subview, frame);
        }

        if (this._contentSize !== null) {
            frame.setActivitySize(this._contentSize);
        }

        let containerDOM = frame.containerDOM;

        if (proposedIndex === this.subviews.length) {
            this._contentDOM.appendChild(containerDOM);
        } else {
            let prevSubview = this.subviews[proposedIndex];
            let prevContainerDOM = this._subviewFrames.get(prevSubview)!.containerDOM
            this._contentDOM.insertBefore(containerDOM, prevContainerDOM);
        }
    }

    public override addSubview(view: HIView): HIViewFrame {
        super.addSubview(view);
        return this._subviewFrames.get(view)!;
    }

    public frameFor(subview: HIView): HIRect {
        let frame = this._subviewFrames.get(subview);
        if (frame === undefined) {
            throw new Error("The view is not a subview of the box.");
        }

        return frame;
    }

    public setFrameFor(subview: HIView, rect: HIRect, autoresizingMask: HIViewAutoresizingMask): void {
        let frame = this._subviewFrames.get(subview);
        if (frame === undefined) {
            throw new Error("The view is not a subview of the box.");
        }

        frame.setXAndWidth(rect.x, rect.width);
        frame.setYAndHeight(rect.y, rect.height);
        frame.autoresizingMask = autoresizingMask;
    }

    public override layout(): void {
        let {width, height} = this.dom.getBoundingClientRect();
        width -= this._contentInsets.minX + this._contentInsets.maxX;
        height -= this._contentInsets.minY + this._contentInsets.maxY;
        this.setContentSize({width, height});
    }

    public setContentSize(size: HISize): void {
        if (this._contentSize === null) {
            this._contentSize = {width: size.width, height: size.height};

            for (let subview of this.subviews) {
                let frame = this._subviewFrames.get(subview)!;
                frame.setActivitySize(this._contentSize);
            }

        } else {
            let {width: oldWidth, height: oldHeight} = this._contentSize;
            let {width: newWidth, height: newHeight} = size;

            let widthChanged = oldWidth !== newWidth;
            let heightChanged = oldHeight !== newHeight;
            if (!widthChanged && !heightChanged) {return;}

            this._contentSize.width = newWidth;
            this._contentSize.height = newHeight;

            for (let subview of this.subviews) {
                let frame = this._subviewFrames.get(subview)!;
                if (widthChanged) {frame.activityWidthChangedFrom(oldWidth);}
                if (heightChanged) {frame.activityHeightChangedFrom(oldHeight);}
            }
        }
    }

    public get contentInsets(): HIEdgeInsets {
        return this._contentInsets;
    }

    public set contentInsets(insets: HIEdgeInsets) {
        if (insets === this._contentInsets) {return;}
        let {minX, minY, maxX, maxY} = insets;
        minX = Math.max(0, _HIAlignScanCoord(minX));
        minY = Math.max(0, _HIAlignScanCoord(minY));
        maxX = Math.max(0, _HIAlignScanCoord(maxX));
        maxY = Math.max(0, _HIAlignScanCoord(maxY));
        HIObservableSetValueForKey(this._contentInsets, "minX", minX);
        HIObservableSetValueForKey(this._contentInsets, "minY", minY);
        HIObservableSetValueForKey(this._contentInsets, "maxX", maxX);
        HIObservableSetValueForKey(this._contentInsets, "maxY", maxY);
        this._contentDOM.style.margin = `${minY}px ${maxX}px ${maxY}px ${minX}px`;

        this.setNeedsLayout();
    }

    public contentInsetsDidChange(insets: HIEdgeInsets, key: keyof HIEdgeInsets, newValue: number): void {
        if (insets !== this._contentInsets) {return;}

        let fixed = Math.max(0, _HIAlignScanCoord(newValue));
        if (fixed !== newValue) {
            HIObservableSetValueForKey(this._contentInsets, key, fixed);
        }

        switch (key) {
        case "minX": this._contentDOM.style.marginLeft = fixed + "px"; break;
        case "minY": this._contentDOM.style.marginTop = fixed + "px"; break;
        case "maxX": this._contentDOM.style.marginRight = fixed + "px"; break;
        case "maxY": this._contentDOM.style.marginBottom = fixed + "px"; break;
        }

        this.setNeedsLayout();
    }

    public get contentBoundingRect(): Readonly<HIRect> {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let subview of this.subviews) {
            let frame = this._subviewFrames.get(subview)!;
            let {x, y, width: w, height: h} = frame;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        }

        if (minX === Infinity) {minX = 0; maxX = 0;}
        if (minY === Infinity) {minY = 0; maxY = 0;}
        return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
    }

    public override get preferredSize(): Readonly<HISize> {
        let {x, y, width, height} = this.contentBoundingRect;
        let {minX, minY, maxX, maxY} = this._contentInsets;
        return {width: x + width + minX + maxX, height: y + height + minY + maxY};
    }
}


const HIViewAutoresizingMaskXMask = HIViewAutoresizingMask.minXMargin | HIViewAutoresizingMask.width | HIViewAutoresizingMask.maxXMargin;
const HIViewAutoresizingMaskYMask = HIViewAutoresizingMask.minYMargin | HIViewAutoresizingMask.height | HIViewAutoresizingMask.maxYMargin;


const enum _HIViewFrameArgMode {
    //  Same as `originAndSize`, but resizing logic is more complex.
    default,

    //  These three modes won’t change its argument when resizing.
    originAndSize,
    originAndMaxMargin,
    maxMarginAndSize,
}


class _HIViewFrame implements HIViewFrame {

    private _xArg1: number;
    private _xArg2: number;
    private _yArg1: number;
    private _yArg2: number;

    private _autoresizingMask: HIViewAutoresizingMask;

    //  These two properties are caches of the autoresizing mask and the activity size.
    private _xArgMode: _HIViewFrameArgMode;
    private _yArgMode: _HIViewFrameArgMode;

    /** This property is a reference to the content size of the parent box. */
    private _activitySize: Nullable<Readonly<HISize>>;

    public readonly containerDOM: HTMLElement;
    public readonly hostingView: HIView;

    public constructor(view: HIView) {
        let {width, height} = view.preferredSize;
    
        let noWidth = width === HIView.noPreferredMetric;
        let noHeight = height === HIView.noPreferredMetric;
    
        if (noWidth || noHeight) {
            _HIWithFreeSizeOfDOM(view.dom, size => {
                if (noWidth) {width = size.width;}
                if (noHeight) {height = size.height;}
            });
        }

        width = _HIAlignScanCoord(width);
        height = _HIAlignScanCoord(height);

        this._xArg1 = 0;
        this._xArg2 = width;
        this._yArg1 = 0;
        this._yArg2 = height;

        this._autoresizingMask = HIViewAutoresizingMask.none;
        this._xArgMode = _HIViewFrameArgMode.originAndSize
        this._yArgMode = _HIViewFrameArgMode.originAndSize;

        this._activitySize = null;

        this.containerDOM = document.createElement("div");
        this.containerDOM.classList.add("hi-box-subview");
        this.containerDOM.appendChild(view.dom);
        this.containerDOM.style.width = width + "px";
        this.containerDOM.style.height = height + "px";

        this.hostingView = view;
    }

    public get x(): number {
        return this._xArgMode === _HIViewFrameArgMode.maxMarginAndSize
            ? this._activitySize!.width - this._xArg1 - this._xArg2
            : this._xArg1;
    }

    public set x(x: number) {
        x = _HIAlignScanCoord(x);
        this.setXAndWidth(x, this.width);
    }

    public get y(): number {
        return this._yArgMode === _HIViewFrameArgMode.maxMarginAndSize
            ? this._activitySize!.height - this._yArg1 - this._yArg2
            : this._yArg1;
    }

    public set y(y: number) {
        y = _HIAlignScanCoord(y);
        this.setYAndHeight(y, this.height);
    }

    public get width(): number {
        return this._xArgMode === _HIViewFrameArgMode.originAndMaxMargin
            ? this._activitySize!.width - this._xArg1 - this._xArg2
            : this._xArg2;
    }

    public set width(width: number) {
        width = _HIAlignScanCoord(width);
        this.setXAndWidth(this.x, width);
    }

    public get height(): number {
        return this._yArgMode === _HIViewFrameArgMode.originAndMaxMargin
            ? this._activitySize!.height - this._yArg1 - this._yArg2
            : this._yArg2;
    }

    public set height(height: number) {
        height = _HIAlignScanCoord(height);
        this.setYAndHeight(this.y, height);
    }

    public get maxX(): number {
        return this.x + this.width;
    }

    public get maxY(): number {
        return this.y + this.height;
    }

    public get autoresizingMask(): HIViewAutoresizingMask {
        return this._autoresizingMask;
    }

    public set autoresizingMask(mask: HIViewAutoresizingMask) {
        if (mask === this._autoresizingMask) {return;}
        mask &= HIViewAutoresizingMaskXMask | HIViewAutoresizingMaskYMask;

        if (this._activitySize === null) {
            this._autoresizingMask = mask;
            return;  //  Nothing to do.
        }

        let {x, y, width, height} = this;

        this._autoresizingMask = mask;
        this._updateArgModes();

        this.setXAndWidth(x, width);
        this.setYAndHeight(y, height);
    }

    public setActivitySize(size: Readonly<HISize>): void {
        if (this._activitySize !== null) {
            throw new Error("The activity size of the view is already set.");
        }

        this._activitySize = size;
        this._updateArgModes();

        //  This method is called only once, therefore, the old value must be `null`.
        this.setXAndWidth(this._xArg1, this._xArg2);
        this.setYAndHeight(this._yArg1, this._yArg2);
    }

    public activityWidthChangedFrom(oldWidth: number): void {
        if (this._xArgMode !== _HIViewFrameArgMode.default) {
            return this.hostingView.setNeedsLayout();
        }

        let mask = this._autoresizingMask;
        let widthParts = 0;
        for (let i = HIViewAutoresizingMask.minXMargin; i <= HIViewAutoresizingMask.maxXMargin; i <<= 1) {
            if ((mask & i) !== 0) {widthParts += 1;}
        }

        let d = (this._activitySize!.width - oldWidth) / widthParts;

        let x = this._xArg1, width = this._xArg2;
        if (mask & HIViewAutoresizingMask.minXMargin) {x += d;}
        if (mask & HIViewAutoresizingMask.width) {width += d;}
        this.setXAndWidth(x, width);
    }

    public activityHeightChangedFrom(oldHeight: number): void {
        if (this._yArgMode !== _HIViewFrameArgMode.default) {
            return this.hostingView.setNeedsLayout();
        }

        let mask = this._autoresizingMask;
        let heightParts = 0;
        for (let i = HIViewAutoresizingMask.minYMargin; i <= HIViewAutoresizingMask.maxYMargin; i <<= 1) {
            if ((mask & i) !== 0) {heightParts += 1;}
        }

        let d = (this._activitySize!.height - oldHeight) / heightParts;

        let y = this._yArg1, height = this._yArg2;
        if (mask & HIViewAutoresizingMask.minYMargin) {y += d;}
        if (mask & HIViewAutoresizingMask.height) {height += d;}
        this.setYAndHeight(y, height);
    }

    public setXAndWidth(x: number, width: number): void {
        //  `left: 0` and `top: 0` are written in the CSS file,
        //  so if they are zero, omit them.

        switch (this._xArgMode) {
        case _HIViewFrameArgMode.default:
        case _HIViewFrameArgMode.originAndSize:
            this._xArg1 = x;
            this._xArg2 = width;
            this.containerDOM.style.left = _HICSSPixelValue(this._xArg1, "");
            this.containerDOM.style.width = _HICSSPixelValue(this._xArg2);
            break;
        case _HIViewFrameArgMode.originAndMaxMargin:
            this._xArg1 = x;
            this._xArg2 = this._activitySize!.width - x - width;
            this.containerDOM.style.left = _HICSSPixelValue(this._xArg1, "");
            this.containerDOM.style.right = _HICSSPixelValue(this._xArg2);
            break;
        case _HIViewFrameArgMode.maxMarginAndSize:
            this._xArg1 = this._activitySize!.width - x - width;
            this._xArg2 = width;
            this.containerDOM.style.right = _HICSSPixelValue(this._xArg1);
            this.containerDOM.style.width = _HICSSPixelValue(this._xArg2);
            break;
        }

        this.hostingView.setNeedsLayout();
    }

    public setYAndHeight(y: number, height: number): void {
        switch (this._yArgMode) {
        case _HIViewFrameArgMode.default:
        case _HIViewFrameArgMode.originAndSize:
            this._yArg1 = y;
            this._yArg2 = height;
            this.containerDOM.style.top = _HICSSPixelValue(this._yArg1, "");
            this.containerDOM.style.height = _HICSSPixelValue(this._yArg2);
            break;
        case _HIViewFrameArgMode.originAndMaxMargin:
            this._yArg1 = y;
            this._yArg2 = this._activitySize!.height - y - height;
            this.containerDOM.style.top = _HICSSPixelValue(this._yArg1, "");
            this.containerDOM.style.bottom = _HICSSPixelValue(this._yArg2);
            break;
        case _HIViewFrameArgMode.maxMarginAndSize:
            this._yArg1 = this._activitySize!.height - y - height;
            this._yArg2 = height;
            this.containerDOM.style.bottom = _HICSSPixelValue(this._yArg1);
            this.containerDOM.style.height = _HICSSPixelValue(this._yArg2);
            break;
        }

        this.hostingView.setNeedsLayout();
    }

    /** This method assumes that `_activitySize` is not `null`. */
    private _updateArgModes(): void {
        //  Invalidate current size constraints.
        this.containerDOM.removeAttribute("style");

        switch (this._autoresizingMask & HIViewAutoresizingMaskXMask) {
        case HIViewAutoresizingMask.minXMargin:
            this.containerDOM.style.left = "auto";
            this._xArgMode = _HIViewFrameArgMode.maxMarginAndSize; break;
        case HIViewAutoresizingMask.width:
            this._xArgMode = _HIViewFrameArgMode.originAndMaxMargin; break;
        case HIViewAutoresizingMask.none:
        case HIViewAutoresizingMask.maxXMargin:
            this._xArgMode = _HIViewFrameArgMode.originAndSize; break;
        default:
            this._xArgMode = _HIViewFrameArgMode.default; break;
        }

        switch (this._autoresizingMask & HIViewAutoresizingMaskYMask) {
        case HIViewAutoresizingMask.minYMargin:
            this.containerDOM.style.top = "auto";
            this._yArgMode = _HIViewFrameArgMode.maxMarginAndSize; break;
        case HIViewAutoresizingMask.height:
            this._yArgMode = _HIViewFrameArgMode.originAndMaxMargin; break;
        case HIViewAutoresizingMask.none:
        case HIViewAutoresizingMask.maxYMargin:
            this._yArgMode = _HIViewFrameArgMode.originAndSize; break;
        default:
            this._yArgMode = _HIViewFrameArgMode.default; break;
        }
    }
}


function _HICSSPixelValue(value: number, zeroRep: string = "0"): string {
    return value ? value + "px" : zeroRep;
}
