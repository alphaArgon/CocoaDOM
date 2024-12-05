/*
 *  HIScrollView.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/1.
 *  Copyright © 2024 alphaArgon.
 */

import { HIColor } from "./HIColor.js";
import { HIObservableSetObserver, HIObservableSetValueForKey } from "./HIObservable.js";
import { HIEvent } from "./HIResponder.js";
import { HIScroller, HIScrollerStyle } from "./HIScroller.js";
import { HIView } from "./HIView.js";
import { HIFindDirectChildDOMFrom } from "./_HIUtils.js";
import { _HIAlignScanCoord, _HIContentInsets } from "./_HISharedLayout.js";
import type { HIEdgeInsets, HIPoint } from "./HIGeometry.js";


export class HIScrollView extends HIView {

    private _contentView: Nullable<HIView>;
    private _contentDOM: HTMLElement;
    private _insetsDOM: HTMLElement;
    private _scrollDOM: HTMLElement;

    private _contentOffset: _HIScrollContentOffset;
    private _contentInsets: _HIContentInsets;

    private _horiScroller: Nullable<HIScroller>;
    private _vertScroller: Nullable<HIScroller>;

    private _backgroundColor: HIColor;

    private _layoutNeedsUpdateContentArea: boolean;
    private _autohidesScrollers: boolean;

    public constructor() {
        super();

        this._contentView = null;
        this._contentDOM = document.createElement("div");
        this._contentDOM.classList.add("hi-scroll-content");

        this._insetsDOM = document.createElement("div");
        this._insetsDOM.classList.add("hi-scroll-insets");
        this._insetsDOM.appendChild(this._contentDOM);

        this._scrollDOM = document.createElement("div");
        this._scrollDOM.classList.add("hi-scroll-scroll");
        this._scrollDOM.addEventListener("scroll", this);
        this._scrollDOM.appendChild(this._insetsDOM);
        this.dom.appendChild(this._scrollDOM);

        this._contentOffset = new _HIScrollContentOffset(this, this._scrollDOM);
        this._contentInsets = new _HIContentInsets();
        HIObservableSetObserver(this._contentInsets, this);

        this._horiScroller = null;
        this._vertScroller = null;

        this._backgroundColor = HIColor.clear;
        this.dom.style.backgroundColor = this._backgroundColor.cssUsage();

        this._layoutNeedsUpdateContentArea = true;
        this._autohidesScrollers = false;
    }

    public static override makeDOM(): HTMLElement {
        let dom = document.createElement("div");
        dom.classList.add("hi-scroll-view");
        return dom;
    }

    protected override insertDOMOfProposedSubview(subview: HIView, proposedIndex: number): void {
        if (subview === this._contentView) {
            this._contentDOM.appendChild(subview.dom);
        } else {
            super.insertDOMOfProposedSubview(subview, proposedIndex);
        }
    }

    public override willRemoveSubview(subview: HIView): void {
        switch (subview) {
        case this._contentView: this._contentView = null; break;
        case this._horiScroller: this._horiScroller = null; break;
        case this._vertScroller: this._vertScroller = null; break;
        }
    }

    public get backgroundColor(): HIColor {
        return this._backgroundColor;
    }

    public set backgroundColor(color: HIColor) {
        if (this._backgroundColor === color) {return;}
        this._backgroundColor = color;
        this.dom.style.backgroundColor = color.cssUsage();
    }

    public get contentView(): Nullable<HIView> {
        return this._contentView;
    }

    public set contentView(view: Nullable<HIView>) {
        if (this._contentView === view) {return;}
        if (this._contentView !== null) {
            this._contentView.removeFromSuperview();
        }
        
        this._contentView = view;

        if (this._contentView !== null) {
            this.insertSubview(this._contentView, 0);
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

        this._layoutNeedsUpdateContentArea = true;
        this.setNeedsLayout();
    }

    public contentInsetsDidChange(insets: HIEdgeInsets, key: keyof HIEdgeInsets, newValue: number): void {
        if (insets !== this._contentInsets) {return;}

        let fixed = Math.max(0, _HIAlignScanCoord(newValue));
        if (fixed !== newValue) {
            HIObservableSetValueForKey(this._contentInsets, key, fixed);
        }

        this._layoutNeedsUpdateContentArea = true;
        this.setNeedsLayout();
    }

    /** Returns the offset from the content area’s origin to the content view’s origin, which is
      * the inverse of the scrolled distance.
      * 
      * Note that this property is not the same as `UIScrollView.contentOffset`; the latter counts
      * `contentInset` as part of the content area, which is hard to use in practice. */
    public get contentOffset(): HIPoint {
        return this._contentOffset;
    }

    public set contentOffset(point: HIPoint) {
        this._contentOffset.setPoint(point);
    }

    public get hasHorizontalScroller(): boolean {
        return this._horiScroller !== null;
    }

    public set hasHorizontalScroller(flag: boolean) {
        if (flag === (this._horiScroller !== null)) {return;}
        if (!flag) {
            this._horiScroller?.removeFromSuperview();
            this._horiScroller = null;
        } else {
            this._horiScroller = new HIScroller(true);
            this._horiScroller.target = this;
            this._horiScroller.action = "scrollWithScroller";
            this.addSubview(this._horiScroller);
        }

        this._layoutNeedsUpdateContentArea = true;
        this.setNeedsLayout();
    }

    public get hasVerticalScroller(): boolean {
        return this._vertScroller !== null;
    }

    public set hasVerticalScroller(flag: boolean) {
        if (flag === (this._vertScroller !== null)) {return;}
        if (!flag) {
            this._vertScroller?.removeFromSuperview();
            this._vertScroller = null;
        } else {
            this._vertScroller = new HIScroller(false);
            this._vertScroller.target = this;
            this._vertScroller.action = "scrollWithScroller";
            this.addSubview(this._vertScroller);
        }

        this._layoutNeedsUpdateContentArea = true;
        this.setNeedsLayout();
    }

    public get autohidesScrollers(): boolean {
        return this._autohidesScrollers;
    }

    public set autohidesScrollers(flag: boolean) {
        if (flag === this._autohidesScrollers) {return;}

        if (!flag) {
            if (this._horiScroller !== null) {
                this._horiScroller.dom.hidden = false;
            }

            if (this._vertScroller !== null) {
                this._vertScroller.dom.hidden = false;
            }
        }

        this._autohidesScrollers = flag;
        this._layoutNeedsUpdateContentArea = true;
        this.setNeedsLayout();
    }

    public override setNeedsLayout(): void {
        super.setNeedsLayout();
        this._contentView?.setNeedsLayout();
        this._horiScroller?.setNeedsLayout();
        this._vertScroller?.setNeedsLayout();
    }

    public override layout(): void {
        let updateContentArea: boolean;
        do {
            updateContentArea = this._layoutNeedsUpdateContentArea;

            if (this._horiScroller !== null) {
                let insets = this._contentInsets.minX + this._contentInsets.maxX;
                let boxWidth = this._scrollDOM.offsetWidth - insets;
                let scrollWidth = this._scrollDOM.scrollWidth - insets;
                let scrollX = this._scrollDOM.scrollLeft;
                this._updateScroller(this._horiScroller, scrollX, scrollWidth, boxWidth);

                if (this._autohidesScrollers
                 && this._horiScroller.style !== HIScrollerStyle.overlay) {
                    let hide = scrollWidth <= boxWidth;
                    if (hide !== this._horiScroller.dom.hidden) {
                        this._horiScroller.dom.hidden = hide;
                        updateContentArea = true;
                    }
                }
            }

            if (this._vertScroller !== null) {
                let insets = this._contentInsets.minY + this._contentInsets.maxY;
                let boxHeight = this._scrollDOM.offsetHeight - insets;
                let scrollHeight = this._scrollDOM.scrollHeight - insets;
                let scrollY = this._scrollDOM.scrollTop;
                this._updateScroller(this._vertScroller, scrollY, scrollHeight, boxHeight);

                if (this._autohidesScrollers
                 && this._vertScroller.style !== HIScrollerStyle.overlay) {
                    let hide = scrollHeight <= boxHeight;
                    if (hide !== this._vertScroller.dom.hidden) {
                        this._vertScroller.dom.hidden = hide;
                        updateContentArea = true;
                    }
                }
            }

            if (updateContentArea) {
                this._updateContentArea();
                this._layoutNeedsUpdateContentArea = false;
            }
        } while (updateContentArea);
    }

    private _updateContentArea(): void {
        let scrollerWidth = 0;
        if (this._vertScroller !== null
         && this._vertScroller.style !== HIScrollerStyle.overlay
         && !this._vertScroller.dom.hidden) {
            scrollerWidth = this._vertScroller.scrollerWidth;
        }

        let scrollerHeight = 0;
        if (this._horiScroller !== null
            && this._horiScroller.style !== HIScrollerStyle.overlay
            && !this._horiScroller.dom.hidden) {
                scrollerHeight = this._horiScroller.scrollerWidth;
        }

        let {minX: minXInset, minY: minYInset, maxX: maxXInset, maxY: maxYInset} = this._contentInsets;
        this._contentDOM.style.margin = `${minYInset}px ${maxXInset + scrollerWidth}px ${maxYInset + scrollerHeight}px ${minXInset}px`;

        if (this._horiScroller !== null) {
            let dom = this._horiScroller.dom;
            dom.style.left = `${minXInset}px`;
            dom.style.right = `${maxXInset + scrollerWidth}px`;  //  Avoid the vertical scroller.
            dom.style.bottom = `${maxYInset}px`;
        }

        if (this._vertScroller !== null) {
            let dom = this._vertScroller.dom;
            dom.style.top = `${minYInset}px`;
            dom.style.right = `${maxXInset}px`;
            dom.style.bottom = `${maxYInset}px`;
        }

        this.setNeedsLayout();
    }

    private _updateScroller(scroller: HIScroller, scroll: number, scrollSize: number, boxSize: number): void {
        if (scroll <= 0) {
            scroller.knobProportion = boxSize / (scrollSize - scroll);
            scroller.value = 0;
        } else if (scroll >= scrollSize - boxSize) {
            scroller.knobProportion = boxSize / (scroll + boxSize);
            scroller.value = 1;
        } else {
            scroller.knobProportion = boxSize / scrollSize;
            scroller.value = scroll / (scrollSize - boxSize);
        }
    }

    public scrollWithScroller(sender: HIScroller): void {
        switch (sender) {
        case this._horiScroller:
            let boxWidth = this._scrollDOM.offsetWidth;
            let scrollWidth = this._scrollDOM.scrollWidth;
            this._contentOffset.x = sender.value * (boxWidth - scrollWidth);
            break;
        case this._vertScroller:
            let boxHeight = this._scrollDOM.offsetHeight;
            let scrollHeight = this._scrollDOM.scrollHeight;
            this._contentOffset.y = sender.value * (boxHeight - scrollHeight);
            break;
        default: break;
        }
    }

    public override handleEvent(event: Event): void {
        if (event.type === "scroll") {
            this.setNeedsLayout();
        } else {
            super.handleEvent(event);
        }
    }

    public override scrollWheel(event: HIEvent<WheelEvent>): void {
        let element = HIFindDirectChildDOMFrom(event.native.target as HTMLElement, this.dom);
        if (element !== this._scrollDOM) {
            return super.scrollWheel(event);
        }

        let passiveX = false;
        let scrollX = this._scrollDOM.scrollLeft;
        if (event.native.deltaX <= 0 && scrollX <= 0
         || event.native.deltaX >= 0 && scrollX >= this._scrollDOM.scrollWidth - this._scrollDOM.offsetWidth) {
            passiveX = true;
        }

        let passiveY = false;
        let scrollY = this._scrollDOM.scrollTop;
        if (event.native.deltaY <= 0 && scrollY <= 0
         || event.native.deltaY >= 0 && scrollY >= this._scrollDOM.scrollHeight - this._scrollDOM.offsetHeight) {
            passiveY = true;
        }

        if (passiveX && passiveY) {
            return super.scrollWheel(event);
        }

        event.setAllowsNativeDefault();
        if (event.native.deltaY !== 0 || event.native.deltaX !== 0) {
            this.setNeedsLayout();
        }
    }
}


class _HIScrollContentOffset implements HIPoint {

    private _scrollView: HIScrollView;
    private _scrollDOM: HTMLElement;

    public constructor(scrollView: HIScrollView, scrollDOM: HTMLElement) {
        this._scrollView = scrollView;
        this._scrollDOM = scrollDOM;
    }

    public get x(): number {
        return -this._scrollDOM.scrollLeft;
    }

    public set x(value: number) {
        this._scrollDOM.scrollLeft = -value;
        this._scrollView.setNeedsLayout();
    }

    public get y(): number {
        return -this._scrollDOM.scrollTop;
    }

    public set y(value: number) {
        this._scrollDOM.scrollTop = -value;
        this._scrollView.setNeedsLayout();
    }

    public setPoint(point: HIPoint): void {
        let {x, y} = point;
        this._scrollDOM.scrollLeft = -x;
        this._scrollDOM.scrollTop = -y;
        this._scrollView.setNeedsLayout();
    }
}
