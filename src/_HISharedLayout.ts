/*
 *  _HISharedLayout.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/1.
 *  Copyright © 2024 alphaArgon.
 */

import { HIRoundCoordinate } from "./_HIUtils.js";
import { HIObservable } from "./HIObservable.js";
import type { HISelector } from "./HIResponder.js";
import type { HIEdgeInsets, HISize } from "./HIView.js";


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
        this._width = HIRoundCoordinate(width);
        this._height = HIRoundCoordinate(height);
    }

    public get width(): number {
        return this._width;
    }

    public set width(width: number) {
        this._width = HIRoundCoordinate(width);
    }

    public get height(): number {
        return this._height;
    }

    public set height(height: number) {
        this._height = HIRoundCoordinate(height);
    }
}
