/*
 *  HIColor.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/19.
 *  Copyright © 2024 alphaArgon.
 */

import { HIAppearance } from "./HIAppearance.js";
import type { HIAppearanceSPI } from "./_HIInternal.js";


/** Components in floating-point between 0 and 1. */
type _HIColorRGBA = readonly [number, number, number, number];


export const enum HIColorBlendMode {
    normal,
    darken, lighten,
    multiply, screen,
    colorBurn, colorDodge,
    linearBurn, linearDodge,
    overlay, hardLight, softLight,
}


export class HIColor {

    private _name: Nullable<string>;
    private _type: 0 | 1 | 2;  //  0: static, 1: light-dark, 2: computed, 3: accent
    private _provider: _HIColorRGBA | _HIColorRGBA[] | ((appearance: HIAppearance) => HIColor);

    //  Created when needed. If the color is static, this won’t be needed.
    private _resolved: Nullable<WeakMap<HIAppearance, HIColor>>;

    private _cssVarName: Nullable<string>;

    private constructor(type: 0, provider: _HIColorRGBA, name: Nullable<string>);
    private constructor(type: 1, provider: _HIColorRGBA[], name: Nullable<string>);
    private constructor(type: 2, provider: (appearance: HIAppearance) => HIColor, name: Nullable<string>);
    private constructor(type: 0 | 1 | 2, provider: any, name: Nullable<string>) {
        this._name = name;
        this._type = type;
        this._provider = provider;
        this._resolved = null;
        this._cssVarName = null;
    }

    /** Creates a static color with the given RGBA components between 0 and 1. */
    public static fromComponents(r: number, g: number, b: number, a: number = 1): HIColor {
        r =_HIColorCompClamp(r);
        g =_HIColorCompClamp(g);
        b =_HIColorCompClamp(b);
        a =_HIColorCompClamp(a);
        return new HIColor(0, [r, g, b, a], null);
    }

    /** Creates a static gray color */
    public static fromGrayscale(brightness: number, alpha: number = 1): HIColor {
        if (brightness <= 0) {return HIColor.black;}
        if (brightness >= 1) {return HIColor.white;}
        return new HIColor(0, [brightness, brightness, brightness, alpha], null);
    }

    /** Creates a dynamic color that depends on the appearance. */
    public static dynamicProvided(provider: (appearance: HIAppearance) => HIColor): HIColor {
        return new HIColor(2, provider, null);
    }

    public get isResolved(): boolean {
        return this._type === 0;
    }

    public get isDynamicProvided(): boolean {
        return this._type >= 2;
    }

    private _withName(name: string): HIColor {
        return new HIColor(this._type as any, this._provider as any, name);
    }

    private _mappingRGBA(body: (rgba: _HIColorRGBA) => _HIColorRGBA): HIColor {
        switch (this._type) {
        case 0: return new HIColor(0, body(this._provider as _HIColorRGBA), null);
        case 1: return new HIColor(1, (this._provider as _HIColorRGBA[]).map(body), null);
        case 2: return new HIColor(2, appearance => this.resolved(appearance)._mappingRGBA(body), null);
        }    
    }

    private _mappingRGBAPair(other: HIColor, body: (back: _HIColorRGBA, fore: _HIColorRGBA) => _HIColorRGBA): HIColor {
        if (this._type === 0 && other._type === 0) {
            let back = this._provider as _HIColorRGBA;
            let fore = other._provider as _HIColorRGBA;
            return new HIColor(0, body(back, fore), null);

        } else if (this._type === 0 && other._type === 1) {
            let back = this._provider as _HIColorRGBA;
            let fores = other._provider as _HIColorRGBA[];
            return new HIColor(1, fores.map(fore => body(back, fore)), null);

        } else if (this._type === 1 && other._type === 0) {
            let backs = this._provider as _HIColorRGBA[];
            let fores = other._provider as _HIColorRGBA;
            return new HIColor(1, backs.map(back => body(back, fores)), null);

        } else if (this._type === 1 && other._type === 1) {
            let backs = this._provider as _HIColorRGBA[];
            let fores = other._provider as _HIColorRGBA[];
            return new HIColor(1, backs.map((back, i) => body(back, fores[i])), null);

        } else {
            return new HIColor(2, appearance => this.resolved(appearance)._mappingRGBAPair(other.resolved(appearance), body), null);
        }
    }

    public withAlpha(alpha: number): HIColor {
        if (alpha >= 1) {return this;}
        if (alpha <= 0) {return HIColor.clear;}
        return this._mappingRGBA(([r, g, b, a]) => [r, g, b, a * alpha]);
    }

    public blending(color: HIColor, strength: number, mode: HIColorBlendMode = HIColorBlendMode.normal): HIColor {
        if (strength <= 0) {return this;}
        if (strength >= 1) {
            if (mode === HIColorBlendMode.normal) {return color;}
            strength = 1;
        }

        return this._mappingRGBAPair(color, (back, fore) => _HIColorRGBABlend(back, fore, strength, mode));
    }

    public composition(color: HIColor, mode: HIColorBlendMode = HIColorBlendMode.normal): HIColor {
        return this._mappingRGBAPair(color, (back, fore) => _HIColorRGBAComposite(back, fore, mode));
    }

    /** Returns a static color that is resolved for the given appearance. If no appearance is
      * provided, the color is resolved for the current appearance or the system appearance. */
    public resolved(appearance?: HIAppearance): HIColor {
        if (this._type === 0) {return this;}

        if (this._resolved === null) {
            this._resolved = new WeakMap();
        }

        if (appearance === undefined) {
            appearance = HIAppearance.current;
        }

        let resolved = this._resolved.get(appearance);
        if (resolved === undefined) {
            switch (this._type) {
            case 2:
                resolved = (this._provider as (appearance: HIAppearance) => HIColor)(appearance);
                resolved = resolved.resolved(appearance);  //  TODO: This may cause infinite loop.
                break;
            case 1:
                resolved = new HIColor(0, (this._provider as _HIColorRGBA[])[appearance.isDark ? 1 : 0], this._name);
                break;
            }

            this._resolved.set(appearance, resolved);
        }

        return resolved;
    }

    /** Returns the RGBA components between 0 and 1.
      * 
      * If the color is dynamic, the components resolved for the current appearance are returned. */
    public get components(): readonly [number, number, number, number] {
        return this.resolved()._provider as _HIColorRGBA;
    }

    /** Returns the brightness of the color.
      * 
      * If the color is dynamic, the brightness resolved for the current appearance is returned. */
    public get brightness(): number {
        let [r, g, b] = this.components;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    /** Returns the hexidecimal notation or the `rgba()` functional notation of the color.
      * 
      * If the color is dynamic, the CSS color resolved for the current appearance is returned. */
    public get cssColor(): string {
        let [r, g, b, a] = this.components;
        if (a === 0) {return "transparent";}

        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);

        if (a === 1) {
            return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
        } else {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
    }

    /** Returns a valid CSS expression that can be used in `color`, `background-color`, etc, no
      * matter the color is dynamic or not.
      * 
      * This method calls `HIAppearance.addCSSVariableProvider` to register the color if it is
      * dynamic, otherwise it simply returns the same value as `cssColor`.
      * 
      * All predefined UI colors, except for `clear`, `black`, and `white`, are registered as a CSS
      * variable. And for convenience, these colors can be used in CSS directly using the format
      * `var(--hi-<color-name>-color)`, where `<color-name>` is the lowercased kebab-case name of
      * the property name. For example, you may use `var(--hi-control-text-color)` to access
      * `HIColor.controlText`. */
    public cssUsage(): string {
        if (this._type === 0 && this._name === null) {
            return this.cssColor;
        }

        if (this._cssVarName === null) {
            let name = this._name ? `--hi-${this._name}-color` : HIAppearance.suggestCSSVariableName()
            this._cssVarName = name;
            HIAppearance.addCSSVariableProvider(name as `--${string}`, appearance => this.resolved(appearance).cssColor);
        }

        return `var(${this._cssVarName})`;
    }

    public static readonly clear                = new HIColor(0, [0, 0, 0, 0], null);
    public static readonly black                = new HIColor(0, [0, 0, 0, 1], null);
    public static readonly white                = new HIColor(0, [1, 1, 1, 1], null);

    public static readonly systemRed            = new HIColor(1, [[1.000, 0.231, 0.188, 1], [1.000, 0.271, 0.227, 1]], "system-red");
    public static readonly systemOrange         = new HIColor(1, [[1.000, 0.584, 0.000, 1], [1.000, 0.624, 0.039, 1]], "system-orange");
    public static readonly systemYellow         = new HIColor(1, [[1.000, 0.800, 0.000, 1], [1.000, 0.839, 0.039, 1]], "system-yellow");
    public static readonly systemGreen          = new HIColor(1, [[0.204, 0.780, 0.349, 1], [0.196, 0.843, 0.294, 1]], "system-green");
    public static readonly systemMint           = new HIColor(1, [[0.000, 0.780, 0.745, 1], [0.388, 0.902, 0.886, 1]], "system-mint");
    public static readonly systemTeal           = new HIColor(1, [[0.188, 0.690, 0.780, 1], [0.251, 0.784, 0.878, 1]], "system-teal");
    public static readonly systemCyan           = new HIColor(1, [[0.196, 0.678, 0.902, 1], [0.392, 0.824, 1.000, 1]], "system-cyan");
    public static readonly systemBlue           = new HIColor(1, [[0.000, 0.478, 1.000, 1], [0.039, 0.518, 1.000, 1]], "system-blue");
    public static readonly systemIndigo         = new HIColor(1, [[0.345, 0.337, 0.839, 1], [0.369, 0.361, 0.902, 1]], "system-indigo");
    public static readonly systemPurple         = new HIColor(1, [[0.686, 0.322, 0.871, 1], [0.749, 0.353, 0.949, 1]], "system-purple");
    public static readonly systemPink           = new HIColor(1, [[1.000, 0.314, 0.400, 1], [1.000, 0.216, 0.373, 1]], "system-pink");
    public static readonly systemBrown          = new HIColor(1, [[0.635, 0.518, 0.369, 1], [0.675, 0.557, 0.408, 1]], "system-brown");
    public static readonly systemGray           = new HIColor(0, [0.557, 0.557, 0.576, 1], "system-gray");

    public static readonly controlAccent        = new HIColor(2, appearance => {
        let accent = (appearance as any as HIAppearanceSPI)._accentColor;
        return accent === null ? HIColor.systemBlue : accent;
    }, "control-accent");

    public static readonly label                = new HIColor(1, [[0, 0, 0, 0.85], [1, 1, 1, 0.85]], "label");
    public static readonly secondaryLabel       = new HIColor(1, [[0, 0, 0, 0.55], [1, 1, 1, 0.55]], "secondary-label");
    public static readonly tertiaryLabel        = new HIColor(1, [[0, 0, 0, 0.25], [1, 1, 1, 0.25]], "tertiary-label");
    public static readonly quaternaryLabel      = new HIColor(1, [[0, 0, 0, 0.10], [1, 1, 1, 0.10]], "quaternary-label");

    public static readonly text                 = new HIColor(1, [[0, 0, 0, 1.0], [1, 1, 1, 1.0]], "text");
    public static readonly textBackground       = new HIColor(1, [[1, 1, 1, 1.0], [0, 0, 0, 1.0]], "text-background");
    public static readonly placeholderText      = HIColor.tertiaryLabel._withName("placeholder-text");

    public static readonly border               = new HIColor(1, [[0, 0, 0, 0.15], [1, 1, 1, 0.15]], "border");

    public static readonly windowFrameText      = new HIColor(1, [[0, 0, 0, 0.7], [1, 1, 1, 0.7]], "window-frame-text");
    public static readonly windowBackground     = new HIColor(1, [[0.929, 0.929, 0.929, 1], [0.156, 0.156, 0.156, 1]], "window-background");

    public static readonly controlText          = HIColor.label._withName("control-text");
    public static readonly disabledControlText  = HIColor.tertiaryLabel._withName("disabled-control-text");
    public static readonly controlBackground    = new HIColor(1, [[1, 1, 1, 1], [0.118, 0.118, 0.118, 1]], "control-background");

    public static readonly selectedControlText  = new HIColor(2, apperance => {
        let isDark = apperance.isDark;
        let textDark = HIColor.controlAccent.resolved(apperance).brightness > 0.6;
        return HIColor.fromGrayscale(textDark ? 0 : 1, (isDark || textDark) ? 0.85 : 1);
    }, "selected-control-text");

    public static readonly selectedContentBackground = new HIColor(2, apperance => {
        let isDark = apperance.isDark;
        return HIColor.controlAccent.resolved(apperance).blending(HIColor.black, isDark ? 0.18 : 0.11, HIColorBlendMode.linearBurn);
    }, "selected-control-background");
}

function _HIColorCompClamp(value: number): number {
    if (value < 0) {return 0;}
    if (value > 1) {return 1;}
    return value;
}

function _HIColorRGBABlend(back: _HIColorRGBA, fore: _HIColorRGBA, strength: number, mode: HIColorBlendMode): _HIColorRGBA {
    //  We are not doing an composition, but color mixing. The former means adding a new layer of
    //  color on top of the existing color, while the latter means transitioning from the source
    //  color to a special color.
    //
    //  How do we blend with strength and alpha at the same time? For example, we wish
    //  `someColor.blending(blackColor, 0.5, .linearBurn)` to be the same as
    //  `someColor.blending(fiftyPercentGrayColor, 1, .linearBurn)`.
    //
    //  First calculate the result alpha as the weighted average of the two alphas, and make two
    //  colors opaque. Then, make the strength be the opacity of the destination color. Finally, do
    //  composition of the two adjusted colors — which will result a opaque color, and assign the
    //  result alpha to it.
    let [br, bg, bb, ba] = back;
    let [ar, ag, ab, aa] = fore;
    let [r, g, b] = _HIColorRGBAComposite([br, bg, bb, 1], [ar, ag, ab, strength], mode);
    let a = _HIColorCompClamp(ba * (1 - strength) + aa * strength);
    return [r, g, b, a];
}

function _HIColorRGBAComposite(back: _HIColorRGBA, fore: _HIColorRGBA, mode: HIColorBlendMode): _HIColorRGBA {
    let [br, bg, bb, ba] = back;
    let [ar, ag, ab, aa] = fore;

    let a = _HIColorCompClamp(ba * (1 - aa) + aa);
    if (a === 0) {return [0, 0, 0, 0];}

    let r = _HIColorCompBlend(br, ar, mode);
    let g = _HIColorCompBlend(bg, ag, mode);
    let b = _HIColorCompBlend(bb, ab, mode);

    let ak = aa * (1 - ba);
    let bk = (1 - aa) * ba;
    let k = aa * ba;

    r = _HIColorCompClamp(bk * br + ak * ar + k * r);
    g = _HIColorCompClamp(bk * bg + ak * ag + k * g);
    b = _HIColorCompClamp(bk * bb + ak * ab + k * b);
    return [r, g, b, a];
}

function _HIColorCompBlend(b: number, a: number, mode: HIColorBlendMode): number {
    switch (mode) {
    case HIColorBlendMode.normal:       return a;
    case HIColorBlendMode.darken:       return Math.min(b, a);
    case HIColorBlendMode.lighten:      return Math.max(b, a);
    case HIColorBlendMode.multiply:     return b * a;
    case HIColorBlendMode.screen:       return b + a - b * a;
    case HIColorBlendMode.colorBurn:    return b === 1 ? 1 : a === 0 ? 0 : 1 - (1 - b) / a;
    case HIColorBlendMode.colorDodge:   return b === 0 ? 0 : a === 1 ? 1 : b / (1 - a);
    case HIColorBlendMode.linearBurn:   return b + a - 1;
    case HIColorBlendMode.linearDodge:  return b + a;
    case HIColorBlendMode.overlay:      return b < 0.5 ? 2 * b * a : 1 - 2 * (1 - b) * (1 - a);
    case HIColorBlendMode.hardLight:    return a < 0.5 ? 2 * b * a : 1 - 2 * (1 - b) * (1 - a);
    case HIColorBlendMode.softLight:    return (1 - 2 * a) * b * b + 2 * a * b;
    }
}

{
    for (let key in HIColor) {
        let color = (HIColor as any)[key];
        color.cssUsage();
    }
}
