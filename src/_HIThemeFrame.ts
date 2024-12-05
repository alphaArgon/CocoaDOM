/*
 *  _HIThemeFrame.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/18.
 *  Copyright © 2024 alphaArgon.
 */

import { HIRect, HISize, HIView } from "./HIView.js";
import { HIColor } from "./HIColor.js";
import { HIAppearance } from "./HIAppearance.js";
import { HINotification, HINotificationCenter } from "./HINotification.js";
import { HIObservable, HIObservableSetObserver, HIObservableSetValueForKey } from "./HIObservable.js";
import { _HITitleBarView, _HIWidgetButton } from "./_HITitleBarView.js";
import { HIViewSPI, HIWindowSPI } from "./_HIInternal.js";
import { _HICheckedSize } from "./_HISharedLayout.js";
import { HIRoundCoordinate, HIRoundRect, HIRoundSize, HISavedGetter, HISetDOMHasAttribute } from "./_HIUtils.js";
import type { HIEvent, HIResponder, HISelector } from "./HIResponder.js";


export const enum HIWindowStyleMask {
    borderless              = 0,
    titled                  = 1 << 0,
    closable                = 1 << 1,
    miniaturizable          = 1 << 2,
    resizable               = 1 << 3,
    fullSizeContentView     = 1 << 15,
}

export const enum _HIWindowDragType {
    move = -1,
    resizeNW, resizeN, resizeNE, resizeE, resizeSE, resizeS, resizeSW, resizeW,
}

const _HIWindowResizerNames = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];


/** The root view of a window, which presents the chrome and content of the window.
  * 
  * `HIWindow` may place the DOM object of the frame view to proper position in the document to
  * show the window. To add a child window or sheet, the DOM object of that window’s frame view
  * can be inserted into the DOM object of the frame view of the parent window. */
export class _HIThemeFrame extends HIView {

    public readonly frame: _HIFrameRect;
    public readonly minSize: _HICheckedSize;
    public readonly maxSize: _HICheckedSize;

    public readonly level: number;
    public readonly styleMask: HIWindowStyleMask;
    public readonly title: string;

    public readonly titleBar: Nullable<_HITitleBarView>;
    public readonly contentView: Nullable<HIView>;

    public readonly backgroundColor: HIColor;

    //  The DOM structure:
    //    .hi-window-scene
    //      .hi-window
    //        .hi-window-title-bar
    //        .hi-window-content
    //        .hi-window-resizer ...
    //      .hi-window-scene of child windows ...

    public readonly frameDOM: HTMLElement;
    private readonly _contentDOM: HTMLElement;

    private _resizersDOM: Nullable<HTMLElement>;
    private readonly _resizerDOMs: HTMLElement[];

    private _frameSizeOnceSet: boolean = false;

    public constructor() {
        super();

        let initialFrame = {x: 0, y: 0, width: 300, height: 200};
        this.frame = new _HIFrameRect(initialFrame);
        this.frameDOM = document.createElement("div");
        this.frameDOM.classList.add("hi-window");
        this.dom.appendChild(this.frameDOM);

        this.minSize = new _HICheckedSize(68, 28);
        this.maxSize = new _HICheckedSize(1e5, 1e5);

        this.level = 0;
        this.styleMask = 0;
        this.title = "";

        this.titleBar = null;
        this.contentView = null;

        this.backgroundColor = null!;
        this.setBackgroundColor(HIColor.windowBackground);

        this._contentDOM = document.createElement("div");
        this._contentDOM.classList.add("hi-window-content");
        this.frameDOM.appendChild(this._contentDOM);

        this._resizersDOM = null;
        this._resizerDOMs = [];

        this.setFrame(initialFrame);
        this._frameSizeOnceSet = false;  //  Suppress the first frame change.
        HIObservableSetObserver(this.frame, this);
    }

    public static override makeDOM(): HTMLElement {
        let dom = document.createElement("section");
        dom.classList.add("hi-window-scene");
        return dom;
    }

    /** The pseudo root of all window frame views.
      * 
      * The pseudo root is a special frame view that is not a part of any window. It is used to
      * manage the order of all top-level windows.
      * 
      * Do not add any subview to the pseudo root. */
    @HISavedGetter
    public static get pseudoRoot(): _HIThemeFrame {
        let root = Object.create(_HIThemeFrame.prototype) as any;
        root._dom = document.body;
        return root;
    }

    public override get appearanceDOM(): HTMLElement {
        return this.frameDOM;
    }

    public setContentView(view: Nullable<HIView>): void {
        if (this.contentView === view) {return;}

        if (this.contentView !== null) {
            (this.contentView as any as HIViewSPI)._setWindowContent(false);
            this.contentView.removeFromSuperview();
        }

        (this as any).contentView = view;

        if (view !== null) {
            (view as any as HIViewSPI)._setWindowContent(true);
            this.addSubview(view);

            if (this._frameSizeOnceSet) {return;}

            let {width, height} = HIRoundSize(view.preferredSize);
            if (width <= 0 || height <= 0) {return;}

            let {x, y} = this.frame;
            if ((this.styleMask & (HIWindowStyleMask.titled | HIWindowStyleMask.fullSizeContentView)) === HIWindowStyleMask.titled) {
                height += this.titleBar!.height;
            }

            this.setFrame({x, y, width: width, height: height});
        }
    }

    public override insertDOMOfProposedSubview(subview: HIView, proposedIndex: number): void {
        switch (subview) {
        case this.titleBar: this.frameDOM.prepend(subview.dom); break;
        case this.contentView: this._contentDOM.appendChild(subview.dom); break;
        default:
            console.error("Unknown subview inserted into _HIThemeFrame");
            super.insertDOMOfProposedSubview(subview, proposedIndex);
            break;
        }
    }

    public setTransform(a: number, b: number, c: number, d: number, tx: number, ty: number): void {
        this.frameDOM.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})`;
    }

    public setFrame(rect: HIRect): void {
        if (rect === this.frame) {return;}

        let {x, y, width, height} = HIRoundRect(rect);
        HIObservableSetValueForKey(this.frame, "x", x);
        HIObservableSetValueForKey(this.frame, "y", y);
        HIObservableSetValueForKey(this.frame, "width", width);
        HIObservableSetValueForKey(this.frame, "height", height);

        this.frameDOM.style.transform = `translate(${x}px, ${y}px)`;
        this.frameDOM.style.width = `${width}px`;
        this.frameDOM.style.height = `${height}px`;

        this._frameSizeOnceSet = true;
        this._updateResizers();
        this.setNeedsLayout();
    }

    public frameDidChange(frame: _HIFrameRect, key: keyof _HIFrameRect, newValue: number): void {
        let fixedValue = HIRoundCoordinate(newValue);
        if (fixedValue !== newValue) {
            HIObservableSetValueForKey(this.frame, key, fixedValue);
        }

        switch (key) {
        case "x":
        case "y":
            this.frameDOM.style.transform = `translate(${frame.x}px, ${frame.y}px)`;
            break;
        case "width":
            this.frameDOM.style.width = `${fixedValue}px`;
            this._frameSizeOnceSet = true;
            break;
        case "height":
            this.frameDOM.style.height = `${fixedValue}px`;
            this._frameSizeOnceSet = true;
            break;
        default: return;
        }

        this._updateResizers();
        this.setNeedsLayout();
    }

    public setMinSize(size: HISize): void {
        this.minSize.width = size.width;
        this.minSize.height = size.height;
        this._updateResizers();
    }

    public setMaxSize(size: HISize): void {
        this.maxSize.width = size.width;
        this.maxSize.height = size.height;
        this._updateResizers();
    }

    public setLevel(level: number): void {
        if (this.level === level) {return;}
        (this as any).level = level;
        this.dom.style.zIndex = level.toString();
    }

    public setBackgroundColor(color: HIColor): void {
        if (this.backgroundColor === color) {return;}
        (this as any).backgroundColor = color;
        this.frameDOM.style.backgroundColor = color.cssUsage();
    }

    /** Sets whether the window is a key window or the main window.
      * 
      * This method simply toggles the class names of the frame view. CSS may use these class names
      * to determine whether a control should be emphasized. */
    public setKeyOrMainAppearance(key: boolean, main: boolean): void {
        this.frameDOM.classList.toggle("key", key);
        this.frameDOM.classList.toggle("main", main);
        HISetDOMHasAttribute(this.frameDOM, "key-or-main", key || main);
    }

    public setStyleMask(styleMask: HIWindowStyleMask): void {
        if (this.styleMask === styleMask) {return;}
        (this as any).styleMask = styleMask;

        let resizable = (styleMask & HIWindowStyleMask.resizable) !== 0;
        this._setResizable(resizable);

        let titled = (styleMask & HIWindowStyleMask.titled) !== 0;
        this._setHasTitlebar(titled);

        if (titled) {
            this._setTitlebarCoversContent((styleMask & HIWindowStyleMask.fullSizeContentView) !== 0);
            
            let closable = (styleMask & HIWindowStyleMask.closable) !== 0;
            let miniaturizable = (styleMask & HIWindowStyleMask.miniaturizable) !== 0;

            if (closable || miniaturizable || resizable) {
                this.titleBar!.setHasWidgetButtons(true);
                this.titleBar!.widgetButtons!.setEnabledOfButton(_HIWidgetButton.close, closable);
                this.titleBar!.widgetButtons!.setEnabledOfButton(_HIWidgetButton.miniaturize, miniaturizable);
                this.titleBar!.widgetButtons!.setEnabledOfButton(_HIWidgetButton.zoom, resizable);
            } else {
                this.titleBar!.setHasWidgetButtons(false);
            }
        }
    }

    public setTitle(title: string): void {
        if (this.title === title) {return;}
        (this as any).title = title;
        this.titleBar?.setTitle(title);
    }

    private _setHasTitlebar(flag: boolean): void {
        if (!flag) {
            if (this.titleBar !== null) {
                this.titleBar.removeFromSuperview();
            }
            this.frameDOM.classList.remove("titled");
            
        } else {
            if (this.titleBar === null) {
                (this as any).titleBar = new _HITitleBarView();
                this.titleBar!.setTitle(this.title);
            }

            this.insertSubview(this.titleBar!, 0);
            this.frameDOM.classList.add("titled");
        }
    }

    private _setTitlebarCoversContent(flag: boolean): void {
        this.frameDOM.classList.toggle("titlebar-covers-content", flag);
    }

    private _setResizable(flag: boolean): void {
        if (!flag) {
            if (this._resizersDOM !== null) {
                this._resizersDOM.remove();
                this._resizersDOM = null;
                this._resizerDOMs.length = 0;
            }

        } else if (this._resizersDOM === null) {
            this._resizersDOM = document.createElement("div");
            this._resizersDOM.classList.add("hi-window-resizers");

            for (let name of _HIWindowResizerNames) {
                let resizer = document.createElement("div");
                resizer.classList.add("hi-window-resizer", name);
                this._resizerDOMs.push(resizer);
                this._resizersDOM.appendChild(resizer);
            }

            //  Make SE resizer topmost.
            this._resizersDOM.append(this._resizerDOMs[_HIWindowDragType.resizeSE]);
            this.frameDOM.appendChild(this._resizersDOM);
        }
    }

    private _updateResizers() {
        if (this.window !== null && this.window.isInLiveResize) {return;}
        if (this._resizerDOMs.length === 0) {return;}

        let widthMin = this.frame.width <= this.minSize.width;
        let widthMax = this.frame.width >= this.maxSize.width;

        let heightMin = this.frame.height <= this.minSize.height;
        let heightMax = this.frame.height >= this.maxSize.height;

        let allMin = widthMin && heightMin;
        let allMax = widthMax && heightMax;

        let widthFixed = widthMin && widthMax;
        let heightFixed = heightMin && heightMax;

        let anyFixed = widthFixed || heightFixed;

        let doms = this._resizerDOMs;

        doms[_HIWindowDragType.resizeW].hidden = widthFixed;
        doms[_HIWindowDragType.resizeE].hidden = widthFixed;
        doms[_HIWindowDragType.resizeN].hidden = heightFixed;
        doms[_HIWindowDragType.resizeS].hidden = heightFixed;
        doms[_HIWindowDragType.resizeNW].hidden = anyFixed;
        doms[_HIWindowDragType.resizeNE].hidden = anyFixed;
        doms[_HIWindowDragType.resizeSE].hidden = anyFixed;
        doms[_HIWindowDragType.resizeSW].hidden = anyFixed;

        doms[_HIWindowDragType.resizeW].classList.toggle("outward", widthMin);
        doms[_HIWindowDragType.resizeE].classList.toggle("outward", widthMin);
        doms[_HIWindowDragType.resizeW].classList.toggle("inward", widthMax);
        doms[_HIWindowDragType.resizeE].classList.toggle("inward", widthMax);

        doms[_HIWindowDragType.resizeN].classList.toggle("outward", heightMin);
        doms[_HIWindowDragType.resizeS].classList.toggle("outward", heightMin);
        doms[_HIWindowDragType.resizeN].classList.toggle("inward", heightMax);
        doms[_HIWindowDragType.resizeS].classList.toggle("inward", heightMax);

        doms[_HIWindowDragType.resizeNW].classList.toggle("outward", allMin);
        doms[_HIWindowDragType.resizeNE].classList.toggle("outward", allMin);
        doms[_HIWindowDragType.resizeSE].classList.toggle("outward", allMin);
        doms[_HIWindowDragType.resizeSW].classList.toggle("outward", allMin);

        doms[_HIWindowDragType.resizeNW].classList.toggle("inward", allMax);
        doms[_HIWindowDragType.resizeNE].classList.toggle("inward", allMax);
        doms[_HIWindowDragType.resizeSE].classList.toggle("inward", allMax);
        doms[_HIWindowDragType.resizeSW].classList.toggle("inward", allMax);
    }

    public override setNeedsLayout() {
        super.setNeedsLayout();
        this.contentView?.setNeedsLayout();
    }

    public override get nextResponder(): Nullable<HIResponder> {
        return this.window;
    }

    public override acceptsFirstMouse(event: HIEvent<MouseEvent>): boolean {
        return true;
    }

    public override mouseDown(event: HIEvent<MouseEvent>): void {
        let dragType = this._resizerDOMs.indexOf(event.native.target as HTMLElement);
        (this.window as any as HIWindowSPI)._performDrag(event, dragType);
    }
}


export class _HIFrameRect extends HIObservable<HIRect, _HIThemeFrame> {

    public static override get observedKeys(): readonly string[] {
        return ["x", "y", "width", "height"];
    }

    public static override get observerAction(): HISelector<_HIThemeFrame> {
        return "frameDidChange";
    }

    public copy(): HIRect {
        return {x: this.x, y: this.y, width: this.width, height: this.height};
    }
}


{
    HIAppearance.addCSSVariableProvider("--hi-window-glow-visibility", appearance => {
        return appearance.isDark ? "visible" : "hidden";
    });

    HIAppearance.addCSSVariableProvider("--hi-window-shadow", appearance => {
        return appearance.isDark
            ? "0 0 0 var(--min-pixel) rgba(0, 0, 0, 1), 0 10px 30px rgba(0, 0, 0, 0.35)"
            : "0 0 0 var(--min-pixel) rgba(0, 0, 0, 0.25), 0 10px 30px rgba(0, 0, 0, 0.35)";
    });

    HIAppearance.addCSSVariableProvider("--hi-main-window-shadow", appearance => {
        return appearance.isDark
            ? "0 0 0 var(--min-pixel) rgba(0, 0, 0, 1), 0 20px 40px rgba(0, 0, 0, 0.55)"
            : "0 0 0 var(--min-pixel) rgba(0, 0, 0, 0.25), 0 20px 40px rgba(0, 0, 0, 0.55)";
    });
}
