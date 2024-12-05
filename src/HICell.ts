/*
 *  HICell.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/21.
 *  Copyright © 2024 alphaArgon.
 */

import { HIAppearance } from "./HIAppearance.js";
import { HIColor, HIColorBlendMode } from "./HIColor.js";
import type { HIView } from "./HIView.js";
import type { HIControlState } from "./HIControl.js";
import type { HIImage } from "./HIImage.js";


/** A cell is an object that wraps a DOM object and manages its appearance
  *
  * This class is kind of analogous to `NSCell` in AppKit, but an `HICell` cannot be used by
  * multiple views at the same time, and doesn’t handle events. */
export abstract class HICell {

    public readonly dom: HTMLElement;
    public controlView: Nullable<HIView>;

    public constructor(dom: HTMLElement) {
        this.dom = dom;
        this.controlView = null;
    }

    public abstract get title();
    public abstract set title(value: string);

    public abstract get image();
    public abstract set image(value: Nullable<HIImage>);

    public abstract get isEnabled();
    public abstract set isEnabled(value: boolean);

    public abstract get isHighlighted();
    public abstract set isHighlighted(value: boolean);

    public abstract get state();
    public abstract set state(value: HIControlState);
}


{
    let roundedBezelKeyTopColor = HIColor.dynamicProvided(appearance => {
        return appearance.isDark
            ? HIColor.controlAccent.blending(HIColor.black, 0.08)
            : HIColor.controlAccent.blending(HIColor.white, 0.43);
    });

    let roundedBezelKeyBottomColor = HIColor.dynamicProvided(appearance => {
        return appearance.isDark
            ? HIColor.controlAccent.blending(HIColor.black, 0.18)
            : HIColor.controlAccent.blending(HIColor.white, 0)
    });

    let plainBezelKeyColor = HIColor.dynamicProvided(appearance => {
        return appearance.isDark
            ? HIColor.controlAccent.blending(HIColor.black, 0.1)
            : HIColor.controlAccent.blending(HIColor.white, 0.25);
    });

    function highlightedKeyColor(color: HIColor, forDark: boolean = false): HIColor {
        return forDark
            ? color.blending(HIColor.white, 0.09, HIColorBlendMode.linearDodge)
            : color.blending(HIColor.black, 0.09, HIColorBlendMode.linearBurn);
    }

    function monoGradient(cssColor: string): string {
        return `linear-gradient(${cssColor}, ${cssColor})`;
    }

    function borderColor(color: HIColor): HIColor {
        return color.blending(HIColor.black, 0.5, HIColorBlendMode.softLight)
    }

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-background", appearance => {
        return monoGradient(appearance.isDark ? "#fff4" : "#fff");
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-highlighted-background", appearance => {
        return monoGradient(appearance.isDark ? "#fff6" : "#f0f0f0");
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-selected-background", appearance => {
        return monoGradient(appearance.isDark ? "#fff8" : "#e5e5e5");
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-key-background", appearance => {
        let t = roundedBezelKeyTopColor.resolved(appearance);
        let b = roundedBezelKeyBottomColor.resolved(appearance);
        return `linear-gradient(${t.cssColor}, ${b.cssColor})`;
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-highlighted-key-background", appearance => {
        let t = highlightedKeyColor(roundedBezelKeyTopColor.resolved(appearance), appearance.isDark);
        let b = highlightedKeyColor(roundedBezelKeyBottomColor.resolved(appearance), appearance.isDark);
        return `linear-gradient(${t.cssColor}, ${b.cssColor})`;
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-border-color", appearance => {
        return "rgba(0, 0, 0, 0.15)";
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-border-background", appearance => {
        return monoGradient("rgba(0, 0, 0, 0.15)");
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-border-key-background", appearance => {
        if (appearance.isDark) {return "rgba(0, 0, 0, 0.15)";}
        let t = borderColor(roundedBezelKeyTopColor.resolved(appearance));
        let b = borderColor(roundedBezelKeyBottomColor.resolved(appearance));
        return `linear-gradient(${t.cssColor}, ${b.cssColor})`;
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-border-highlighted-key-background", appearance => {
        if (appearance.isDark) {return "rgba(0, 0, 0, 0.15)";}
        let t = borderColor(highlightedKeyColor(roundedBezelKeyTopColor.resolved(appearance)));
        let b = borderColor(highlightedKeyColor(roundedBezelKeyBottomColor.resolved(appearance)));
        return `linear-gradient(${t.cssColor}, ${b.cssColor})`;
    });

    HIAppearance.addCSSVariableProvider("--hi-rounded-bezel-shadow", appearance => {
        return appearance.isDark
            ? "0 1px 1px rgba(0, 0, 0, 0.25), inset 0 1px 1px -1px rgba(255, 255, 255, 1)"
            : "0 1px 1px rgba(0, 0, 0, 0.15)";
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-background-color", appearance => {
        return appearance.isDark ? "#fff2" : "#fff";
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-highlighted-background-color", appearance => {
        return appearance.isDark ? "#fff4" : "#f0f0f0";
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-key-background-color", appearance => {
        return plainBezelKeyColor.resolved(appearance).cssColor;
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-highlighted-key-background-color", appearance => {
        return highlightedKeyColor(plainBezelKeyColor.resolved(appearance), appearance.isDark).cssColor;
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-highlighted-ring-color", appearance => {
        return appearance.isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-shadow", appearance => {
        return appearance.isDark
            ? "inset 0 0 0 var(--min-pixel) rgba(255, 255, 255, 0.1), inset 0 -1px 2px -1px rgba(255, 255, 255, 0.3), 0 0 0 var(--min-pixel) rgba(0, 0, 0, 0.2)"
            : "inset 0 0 0 var(--min-pixel) rgba(100, 100, 100, 0.5), inset 0 1px 2px -1px rgba(0, 0, 0, 0.5)";
    });

    HIAppearance.addCSSVariableProvider("--hi-field-bezel-key-shadow", appearance => {
        return appearance.isDark
            ? "inset 0 0 0 var(--min-pixel) rgba(255, 255, 255, 0.1), inset 0 -1px 2px -1px rgba(255, 255, 255, 0.3), 0 0 0 var(--min-pixel) rgba(0, 0, 0, 0.2)"
            : "inset 0 0 0 var(--min-pixel) rgba(0, 0, 0, 0.1), inset 0 0 transparent";
    });
}
