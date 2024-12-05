/*
 *  HIAppearance.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/19.
 *  Copyright © 2024 alphaArgon.
 */

import { HIMakeLCGID } from "./_HIUtils.js";
import { HINotificationCenter, HINotificationName } from "./HINotification.js";
import type { HIColor } from "./HIColor.js";


const _HICSSVarProviders: Map<string, (appearance: HIAppearance) => string> = new Map();
const _HIAppearancesInUse: Set<HIAppearance> = new Set();
const _HIDOMAppliedAppearances: WeakMap<HTMLElement, HIAppearance> = new WeakMap();

let _HICurrentAppearance: Nullable<HIAppearance> = null;


export class HIAppearance {

    private readonly _name: string;
    private readonly _dom: HTMLStyleElement;
    private readonly _base: Nullable<HIAppearance>;

    /** @internal SPI to `HIColor` */
    private readonly _accentColor: Nullable<HIColor>;
    private _accentedExtensions: Nullable<WeakMap<HIColor, HIAppearance>>;

    private _inUseCount: number;

    private constructor(name: string, inheritedFrom: Nullable<HIAppearance>, accentColor: Nullable<HIColor> = null) {
        this._name = name;
        this._dom = document.createElement("style");
        this._base = inheritedFrom;
        this._accentColor = accentColor;
        this._accentedExtensions = null;
        this._inUseCount = 0;
    }

    public static readonly aqua = new HIAppearance("aqua", null);
    public static readonly darkAqua = new HIAppearance("aqua-dark", null);
    public static readonly accessibilityHighContrastAqua = new HIAppearance("high-contrast", HIAppearance.aqua);
    public static readonly accessibilityHighContrastDarkAqua = new HIAppearance("high-contrast-dark", HIAppearance.darkAqua);

    public static readonly didChangeSystemAppearanceNotification: HINotificationName<void> = "HIDidChangeSystemAppearanceNotification";

    public static get system(): HIAppearance {
        return _HIGetSystemAppearance();
    }

    public static set system(appearance: Nullable<HIAppearance>) {
        _HISetSystemAppearance(appearance);
    }

    /** The current appearance that is used for resolving dynamic colors or custom drawing. */
    public static get current(): HIAppearance {
        return _HICurrentAppearance ?? _HIGetSystemAppearance();
    }

    /** Temporarily sets the current appearance to the receiver and executes the given block. */
    public asCurrent(body: () => void): void {
        let saved = _HICurrentAppearance;
        _HICurrentAppearance = this;
        body();
        _HICurrentAppearance = saved;
    }

    public withAccentColor(accentColor: HIColor): HIAppearance {
        if (accentColor.isDynamicProvided) {
            throw new Error("Dynamic provided accent color will cause infinite recursion.");
        }

        if (accentColor === this._accentColor) {return this;}

        if (this._accentedExtensions !== null) {
            let created = this._accentedExtensions.get(accentColor);
            if (created !== undefined) {return created;}
        }

        //  TODO: Use a semantic name for the appearance.
        let suffix = HIMakeLCGID();
        let name = `${this._name}-${suffix}`;
        return new HIAppearance(name, this, accentColor);
    }

    public get isDark(): boolean {
        let current = this as Nullable<HIAppearance>;
        while (current !== null) {
            if (current === HIAppearance.darkAqua) {return true;}
            current = current._base;
        }
        return false;
    }    

    /** Returns the best match appearance from the given base appearances. For example,
      * the best match of `vibrantDark` from `[aqua, aquaDark]` is `aquaDark`. */
    public bestMatchFrom(baseAppearances: Iterable<HIAppearance>): Nullable<HIAppearance> {
        let bestMatch = null;
        let bestMatchDistance = Infinity;

        for (let appearance of baseAppearances) {
            if (appearance === this) {
                return appearance;
            }

            let distance = 0;
            let current = this as Nullable<HIAppearance>;
            do {
                if (current === appearance) {
                    if (distance < bestMatchDistance) {
                        bestMatch = appearance;
                        bestMatchDistance = distance;
                    }
                    break;
                }

                distance += 1;
                current = current!._base;
            } while (current !== null);
        }

        return bestMatch;
    }

    /** Applies the appearance to the given DOM object. If the DOM object already has an different
      * appearance, the old appearance will be discarded.
      *
      * When the DOM object no longer needs the appearance, you should call `disposeFor` to release
      * the appearance. */
    public applyForDOM(dom: HTMLElement): void {
        let oldAppearance = _HIDOMAppliedAppearances.get(dom);
        if (oldAppearance === this) {return;}
        if (oldAppearance !== undefined) {
            HIAppearance.disposeForDOM(dom);
        }

        if (this._inUseCount === 0) {
            this._updateCSSVariables();
            _HIAppearancesInUse.add(this);
            document.head.appendChild(this._dom);
        }

        this._inUseCount += 1;
        _HIDOMAppliedAppearances.set(dom, this);
        dom.setAttribute("hi-appearance", this._name);
    }

    public static disposeForDOM(dom: HTMLElement): void {
        let appearance = _HIDOMAppliedAppearances.get(dom);
        if (appearance === undefined) {return;}

        appearance._inUseCount -= 1;
        _HIDOMAppliedAppearances.delete(dom);
        dom.removeAttribute("hi-appearance");

        if (appearance._inUseCount === 0) {
            _HIAppearancesInUse.delete(appearance);
            document.head.removeChild(appearance._dom);
        }
    }

    private _updateCSSVariables(): void {
        let saved = _HICurrentAppearance;
        _HICurrentAppearance = this;

        let cssText = `[hi-appearance="${this._name}"] {\n`;
        for (let [name, provider] of _HICSSVarProviders) {
            cssText += `\t${name}: ${provider(this)};\n`;
        }
        cssText += "}";
        this._dom.textContent = cssText;

        _HICurrentAppearance = saved;
    }

    /** Registers a CSS variable provider for the given name.
      * 
      * For example, `HIButtonCell` registers `--hi-button-rounded-border-image` for the nine-part
      * image applied to push buttons.
      * 
      * The provider function may use `bestMatchFrom` to determine whether the appearance is in dark
      * mode or high contrast mode. */
    public static addCSSVariableProvider(name: `--${string}`, provider: (appearance: HIAppearance) => string): void {
        if (_HICSSVarProviders.has(name)) {
            throw new Error(`The CSS variable provider "${name}" has already been registered.`);
        }

        _HICSSVarProviders.set(name, provider);

        for (let appearance of _HIAppearancesInUse) {
            appearance._updateCSSVariables();
        }
    }

    /** Returns a name that is not used by any CSS variable provider. */
    public static suggestCSSVariableName(name?: `--${string}`): `--${string}` {
        let suggested: `--${string}`;

        if (name) {
            let i = 1;
            do {suggested = i === 1 ? name : `${name}-${i}`;}
            while (_HICSSVarProviders.has(suggested));
        } else {
            do {suggested = `--${HIMakeLCGID()}`;}
            while (_HICSSVarProviders.has(suggested));
        }

        return suggested;
    }
}



let _HISystemAppearance: Nullable<HIAppearance> = null;
let _HISystemAppearanceFollowsUserAgent: boolean = true;

function _HIGetSystemAppearance(): HIAppearance {
    if (_HISystemAppearance === null) {
        let isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        let isHighContrast = window.matchMedia("(forced-colors: active)").matches;

        _HISystemAppearance = isDark
            ? isHighContrast ? HIAppearance.accessibilityHighContrastDarkAqua : HIAppearance.darkAqua
            : isHighContrast ? HIAppearance.accessibilityHighContrastAqua : HIAppearance.aqua;
        _HISystemAppearance.applyForDOM(document.body);
    }

    return _HISystemAppearance;
}

function _HISetSystemAppearance(appearance: Nullable<HIAppearance>): void {
    if (appearance === null) {
        if (_HISystemAppearanceFollowsUserAgent) {return;}
        _HISystemAppearanceFollowsUserAgent = true;
        _HISystemAppearance = null;
        _HIGetSystemAppearance();
    } else {
        if (_HISystemAppearance === appearance) {return;}
        _HISystemAppearanceFollowsUserAgent = false;
        _HISystemAppearance = appearance;
        appearance.applyForDOM(document.body);
    }

    HINotificationCenter.default.post(HIAppearance.didChangeSystemAppearanceNotification, null);
}


{
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (!_HISystemAppearanceFollowsUserAgent) {return;}
        _HISystemAppearance = null;
        _HIGetSystemAppearance();
        HINotificationCenter.default.post(HIAppearance.didChangeSystemAppearanceNotification, null);
    });

    window.matchMedia("(forced-colors: active)").addEventListener("change", () => {
        if (!_HISystemAppearanceFollowsUserAgent) {return;}
        _HISystemAppearance = null;
        _HIGetSystemAppearance();
        HINotificationCenter.default.post(HIAppearance.didChangeSystemAppearanceNotification, null);
    });
}
