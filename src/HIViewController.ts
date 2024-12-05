/*
 *  HIViewController.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/9/9.
 *  Copyright © 2024 alphaArgon.
 */

import { HIResponder } from "./HIResponder.js";
import { HIView } from "./HIView.js";
import type { HIViewSPI } from "./_HIInternal.js";


export class HIViewController extends HIResponder {
    
    private _title: string = "";

    private _view: Nullable<HIView> = null;

    private _parent: Nullable<HIViewController> = null;
    private _children: HIViewController[] = [];

    private _presented: Nullable<HIViewController> = null;
    private _presenting: Nullable<HIViewController> = null;

    public get title(): string {
        return this._title;
    }

    public set title(title: string) {
        this._title = title;
    }

    public get isViewLoaded(): boolean {
        return this._view !== null;
    }

    public get view(): HIView {
        if (this._view === null) {
            this.loadView();
            
            if (this._view === null) {
                throw new Error("No view is set from `loadView`.");
            }
        }

        return this._view;
    }

    public set view(view: HIView) {
        let wasViewLoaded = this._view !== null;
        if (wasViewLoaded) {
            (this._view as any as HIViewSPI)._setDelegate(null);
        }

        this._view = view;
        (this._view as any as HIViewSPI)._setDelegate(this);

        if (!wasViewLoaded) {
            this.viewDidLoad();
        }
    }

    protected loadView() {
        this.view = new HIView();
    }

    public viewDidLoad(): void {}

    public override get nextResponder(): Nullable<HIResponder> {
        return (this._view as any as HIViewSPI)._nextResponderIgnoringDelegate;
    }

    //  MARK: - View Controller Hierarchy
    //  Unlike `UIViewController`, we don’t have `willMoveToParent` or `didMoveToParent` methods,
    //  which is identical to the behavior of `NSViewController`.

    public get parent(): Nullable<HIViewController> {
        return this._parent;
    }

    public get children(): readonly HIViewController[] {
        //  TODO: Make readonly
        return this._children;
    }

    public addChild(child: HIViewController): void {
        this.insertChild(child, this._children.length);
    }

    public insertChild(child: HIViewController, index: number): void {
        if (child._parent !== null) {
            child.removeFromParent();
        }

        child._parent = this;
        this._children.splice(index, 0, child);
    }

    public removeFromParent(): void {
        if (this._parent === null) {return;}
        let index = this._parent._children.indexOf(this);
        this._parent._children.splice(index, 1);
        this._parent = null;
    }

    //  These four methods are called by `HIView`.
    public viewWillAppear(): void {}
    public viewDidAppear(): void {}
    public viewWillDisappear(): void {}
    public viewDidDisappear(): void {}

    //  MARK: - Presentation

    public get presented(): Nullable<HIViewController> {
        //  The view controller’s _presented, or its parent’s _presented...
        let vc = this as HIViewController;
        while (vc._presented === null && vc._parent !== null) {vc = vc._parent;}
        return vc._presented;
    }

    public get presenting(): Nullable<HIViewController> {
        return this._presenting;
    }

    //  TODO: Implement `present` and `dismiss` methods when windows can show sheets.
}
