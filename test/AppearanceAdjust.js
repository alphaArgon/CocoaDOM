/*
 *  AppearanceAdjust.ts
 *  Cocoa DOM
 *
 *  Created by alpha on 2024/11/28.
 *  Copyright © 2024 alphaArgon.
 */

import { HIWindow, HIButton, HIAppearance, HIColor, HIPopUpButton, HISlider, HIBox, HILabel, HIViewController } from "../dist/index.js";


class AppearanceAdjustViewController extends HIViewController {

    _sliders;
    _systemCheckbox;
    _systemPopUp;
    
    _useHSL;
    _useDark;
    _color;

    _actionSentBySlider;

    static rgbCompNames = ["Red", "Green", "Blue"];
    static hslCompNames = ["Hue", "Sat", "Light"];
    static systemColors = ["Blue", "Purple", "Pink", "Red", "Orange", "Yellow", "Green", "Gray"].map(name => {
        return {name, color: HIColor["system" + name]};
    });

    loadView() {
        let box = new HIBox();
        this.view = box;

        box.contentInsets = {minX: 20, minY: 20, maxX: 20, maxY: 20};

        this._sliders = AppearanceAdjustViewController.rgbCompNames.map((name, i) => {
            let label = new HILabel(name + ":");
            label.alignment = 2;  //  right
            let labelFrame = box.addSubview(label);
            labelFrame.x = -10;
            labelFrame.y = i * 25;
            labelFrame.width = 50;

            let slider = new HISlider(0, 0, 1, this, "takeSliderValue");
            slider.isContinuous = true;
            let sliderFrame = box.addSubview(slider);
            sliderFrame.x = labelFrame.maxX + 12;
            sliderFrame.y = labelFrame.y;
            sliderFrame.width = 220;
            sliderFrame.autoresizingMask = 2;  //  width

            return slider;
        });

        let modeLabel = new HILabel("Mode:");
        modeLabel.alignment = 2;  //  right

        let modeLabelFrame = box.addSubview(modeLabel);
        modeLabelFrame.x = -10;
        modeLabelFrame.y = 80;
        modeLabelFrame.width = 50;

        this._useHSL = false;
        let rgbRadio = HIButton.radioButton("RGB", this, "useColorMode");
        rgbRadio.state = 1;
        rgbRadio.tag = 0;
        let rgbRadioFrame = box.addSubview(rgbRadio);
        rgbRadioFrame.x = modeLabelFrame.maxX + 10;
        rgbRadioFrame.y = modeLabelFrame.y;

        let hSLRadio = HIButton.radioButton("HSL", this, "useColorMode");
        hSLRadio.tag = 1;
        let hslRadioFrame = box.addSubview(hSLRadio);
        hslRadioFrame.x = rgbRadioFrame.maxX + 10;
        hslRadioFrame.y = modeLabelFrame.y;

        this._systemCheckbox = HIButton.checkbox("Use System Color", this, "toggleSystem");
        this._systemCheckbox.state = 1;
        let systemCheckboxFrame = box.addSubview(this._systemCheckbox);
        systemCheckboxFrame.x = rgbRadioFrame.x;
        systemCheckboxFrame.y = 105;

        this._systemPopUp = new HIPopUpButton(this, "updateSystemColor");
        for (let {name} of AppearanceAdjustViewController.systemColors) {
            this._systemPopUp.addItem(name);
        }

        this._color = AppearanceAdjustViewController.systemColors[0].color;
        this._systemPopUp.indexOfSelectedItem = 0;

        let systemPopUpFrame = box.addSubview(this._systemPopUp);
        systemPopUpFrame.x = systemCheckboxFrame.maxX + 4;
        systemPopUpFrame.y = systemCheckboxFrame.y;
        systemPopUpFrame.width = 270 - systemPopUpFrame.x;

        this._darkCheckbox = HIButton.checkbox("Dark Appearance", this, "toggleDark");
        let darkAppearanceFrame = box.addSubview(this._darkCheckbox);
        darkAppearanceFrame.x = systemCheckboxFrame.x;
        darkAppearanceFrame.y = 130;
    }

    static convertToHSL([r, g, b]) {
        let max = Math.max(r, g, b);
        let min = Math.min(r, g, b);
        let d = max - min;

        let h, s;
        let l = (max + min) / 2;
    
        if (d === 0) {
            h = s = 0;

        } else {
            let sum = max + min;
            s = l > 0.5 ? d / (2 - sum) : d / sum;

            switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }
    
        return [h, s, l];
    }

    static convertToRGB([h, s, l]) {
        h %= 1;

        let c = (1 - Math.abs(2 * l - 1)) * s;
        let x = c * (1 - Math.abs(h * 6 % 2 - 1));
        let m = l - c / 2;

        let r, g, b;
        switch (Math.floor(h * 6)) {
        case 0: r = c; g = x; b = 0; break;
        case 1: r = x; g = c; b = 0; break;
        case 2: r = 0; g = c; b = x; break;
        case 3: r = 0; g = x; b = c; break;
        case 4: r = x; g = 0; b = c; break;
        case 5: r = c; g = 0; b = x; break;
        }

        return [r + m, g + m, b + m];
    }

    viewWillAppear() {
        this._useDark = HIAppearance.system.isDark;
        this._darkCheckbox.state = this._useDark ? 1 : 0;
        this._actionSentBySlider = false;
        this.commitAppearance();
    }

    viewWillDisappear() {
        HIAppearance.system = null;
    }

    commitAppearance() {
        let base = this._useDark ? HIAppearance.darkAqua : HIAppearance.aqua;
        let appearance = base.withAccentColor(this._color);
        HIAppearance.system = appearance;

        if (this._actionSentBySlider) {return;}

        let comps = this._color.resolved(appearance).components;
        if (this._useHSL) {
            comps = AppearanceAdjustViewController.convertToHSL(comps);
        }

        for (let i = 0; i < 3; ++i) {
            this._sliders[i].value = comps[i];
        }
    }

    useColorMode(sender) {
        let usesHSL = sender.tag === 1;
        if (usesHSL === this._useHSL) {return;}
        this._useHSL = usesHSL;

        let compNames;
        let comps = this._sliders.map(slider => slider.value);

        if (usesHSL) {
            compNames = AppearanceAdjustViewController.hslCompNames;
            comps = AppearanceAdjustViewController.convertToHSL(comps);
        } else {
            compNames = AppearanceAdjustViewController.rgbCompNames;
            comps = AppearanceAdjustViewController.convertToRGB(comps);
        }

        for (let i = 0; i < 3; ++i) {
            this.view.subviews[i * 2].string = compNames[i] + ":";
            this._sliders[i].value = comps[i];
        }
    }

    takeSliderValue(sender) {
        this._actionSentBySlider = true;
        this.updateCustomColor(sender);
        this._actionSentBySlider = false;
    }

    updateCustomColor(sender) {
        let comps = this._sliders.map(slider => slider.value);
        if (this._useHSL) {
            comps = AppearanceAdjustViewController.convertToRGB(comps);
        }

        this._color = HIColor.fromComponents(comps[0], comps[1], comps[2]);
        this._systemCheckbox.state = 0;
        this.commitAppearance();
    }

    updateSystemColor(sender) {
        let index = this._systemPopUp.indexOfSelectedItem;
        this._color = AppearanceAdjustViewController.systemColors[index].color;
        this._systemCheckbox.state = 1;
        this.commitAppearance();
    }

    toggleSystem(sender) {
        this._systemCheckbox.state
            ? this.updateSystemColor(sender)
            : this.updateCustomColor(sender);
    }

    toggleDark(sender) {
        this._useDark = sender.state === 1;
        this.commitAppearance();
    }
}

let appearanceWindow = new HIWindow();
appearanceWindow.title = "Appearance Adjust";
appearanceWindow.styleMask = 1 | 2 | 8;  //  titled, closable, resizable
appearanceWindow.contentViewController = new AppearanceAdjustViewController();
appearanceWindow.minSize = appearanceWindow.frame;

export default appearanceWindow;
