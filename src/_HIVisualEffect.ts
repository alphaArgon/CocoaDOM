/*
 *  _HIVisualEffect.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/23.
 *  Copyright © 2024 alphaArgon.
 */

import { HIColor } from "./HIColor.js";


export const enum _HITranslucentStyle {
    thin,   //  Menu, popover, etc.
    medium, //  Sidebar, sheet, etc.
    thick,  //  Tooltip, header, etc.
    selection, emphasizedSelection,
}

const _HITranslucentThinColor = HIColor.windowBackground.withAlpha(0.65);
const _HITranslucentMediumColor = HIColor.windowBackground.withAlpha(0.75);
const _HITranslucentThickColor = HIColor.windowBackground.withAlpha(0.85);
const _HITranslucentSelectionColor = HIColor.windowBackground.blending(HIColor.systemGray, 0.5).withAlpha(0.5);
const _HITranslucentEmphasizedSelectionColor = HIColor.controlAccent.withAlpha(0.75);


export function _HIApplyTranslucencyForDOM(dom: HTMLElement, style: _HITranslucentStyle): void {
    switch (style) {
    case _HITranslucentStyle.thin:
        dom.style.backgroundColor = _HITranslucentThinColor.cssUsage();
        dom.classList.add("hi-backdrop-translucency"); break;
    case _HITranslucentStyle.medium:
        dom.style.backgroundColor = _HITranslucentMediumColor.cssUsage();
        dom.classList.add("hi-backdrop-translucency"); break;
    case _HITranslucentStyle.thick:
        dom.style.backgroundColor = _HITranslucentThickColor.cssUsage();
        dom.classList.add("hi-backdrop-translucency"); break;
    case _HITranslucentStyle.selection:
        dom.style.backgroundColor = _HITranslucentSelectionColor.cssUsage();
        dom.classList.add("hi-backdrop-translucency"); break;
    case _HITranslucentStyle.emphasizedSelection:
        dom.style.backgroundColor = _HITranslucentEmphasizedSelectionColor.cssUsage();
        dom.classList.add("hi-backdrop-translucency", "monotone"); break;
    }
}
