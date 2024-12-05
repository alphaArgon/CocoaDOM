/*
 *  SimplePath.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/5.
 *  Copyright © 2024 alphaArgon.
 */

import { HIWindow, HIButton, HIColor, HIPopUpButton, HIBox, HIViewController, HIDrawingView } from "../dist/index.js";


class SimplePathView extends HIDrawingView {

    _backgroundColor;
    _foregroundColor;
    _polylines;
    _lineWidth;

    delegate;

    constructor() {
        super();

        this._backgroundColor = HIColor.textBackground;
        this._foregroundColor = HIColor.controlAccent;
        this._polylines = [];
        this._lineWidth = 4;

        this.delegate = null;
    }

    didChangeEffectiveAppearance() {
        this.delegate?.viewDidChangeEffectiveAppearance(this);
    }

    drawRect(rect, ctx) {
        ctx.fillStyle = this._backgroundColor.cssColor;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        ctx.lineWidth = this._lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let polyline of this._polylines) {
            ctx.strokeStyle = polyline.color.cssColor;
            ctx.beginPath();
            for (let i = 0; i < polyline.length; i++) {
                let {x, y} = polyline[i];
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }

            ctx.stroke();
        }
    }

    mouseDown(event) {
        this.beginPath();
        this._addPointWithEvent(event);
    }

    mouseDragged(event) {
        this._addPointWithEvent(event);
    }

    mouseUp(event) {
        this._addPointWithEvent(event);
        this.delegate?.viewDidEndDrawing(this);
    }

    _addPointWithEvent(event) {
        let {clientX: x, clientY: y} = event.native;
        let {x: minX, y: minY, width, height} = this.dom.getBoundingClientRect();
        x = Math.max(0, Math.min(x - minX, width));
        y = Math.max(0, Math.min(y - minY, height));
        this.addPoint(x, y);
    }

    beginPath() {
        let polyline = [];
        polyline.color = this._foregroundColor;
        this._polylines.push(polyline);
    }

    addPoint(x, y) {
        let polyline = this._polylines[this._polylines.length - 1];
        let prevPoint = polyline[polyline.length - 1];
        polyline.push({x, y});

        if (prevPoint === undefined) {
            polyline.pointBounds = {x, y, width: 0, height: 0};
            this.setNeedsDisplay();

        } else {
            let minX = Math.min(prevPoint.x, x);
            let minY = Math.min(prevPoint.y, y);
            let maxX = Math.max(prevPoint.x, x);
            let maxY = Math.max(prevPoint.y, y);

            let dirtyRect = {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
            dirtyRect.x -= this._lineWidth / 2;
            dirtyRect.y -= this._lineWidth / 2;
            dirtyRect.width += this._lineWidth;
            dirtyRect.height += this._lineWidth;

            this.setNeedsDisplay(dirtyRect);
        }
    }

    clear(sender) {
        this._polylines.length = 0;
        this.setNeedsDisplay();
    }

    get isEmpty() {
        return this._polylines.length === 0;
    }

    get backgroundColor() {
        return this._backgroundColor;
    }

    set backgroundColor(color) {
        this._backgroundColor = color;
        this.setNeedsDisplay();
    }

    get foregroundColor() {
        return this._foregroundColor;
    }

    set foregroundColor(color) {
        this._foregroundColor = color;
    }
}


class SimplePathViewController extends HIViewController {

    _pathView;
    _clearButton;
    _colorPopUp;

    static foregroundColors = [
        {name: "Default", color: HIColor.text},
        {name: "Accent", color: HIColor.controlAccent},
        {name: "Red", color: HIColor.systemRed},
        {name: "Orange", color: HIColor.systemOrange},
        {name: "Yellow", color: HIColor.systemYellow},
        {name: "Green", color: HIColor.systemGreen},
        {name: "Teal", color: HIColor.systemTeal},
        {name: "Blue", color: HIColor.systemBlue},
        {name: "Indigo", color: HIColor.systemIndigo},
        {name: "Purple", color: HIColor.systemPurple},
        {name: "Pink", color: HIColor.systemPink},
        {name: "Brown", color: HIColor.systemBrown},
        {name: "Gray", color: HIColor.systemGray},
    ]

    static initialPaths = [
        [HIColor.systemGreen, 26, 184, 63, 169, 108, 130, 108, 109, 108, 98, 104, 96, 99, 96, 84, 96, 81, 117, 67, 204],
        [HIColor.systemYellow, 67, 204, 71, 174, 79, 153, 97, 153, 109, 153, 115, 159, 115, 166, 115, 171, 110, 177, 110, 186, 110, 201, 117, 205, 124, 205, 132, 205, 141, 201, 148, 196],
        [HIColor.systemOrange, 148, 196, 158, 188, 167, 178, 167, 169, 167, 163, 165, 151, 154, 151, 143, 151, 139, 162, 139, 173, 139, 187, 148, 202, 163, 202, 175, 202, 187, 195, 197, 184],
        [HIColor.systemRed, 199, 183, 214, 167, 224, 143, 224, 126, 224, 102, 220, 98, 213, 98, 204, 98, 194, 113, 194, 154, 194, 187, 204, 200, 217, 200, 231, 200, 243, 193, 252, 182],
        [HIColor.systemPurple, 252, 183, 268, 165, 278, 138, 278, 119, 278, 104, 274, 97, 267, 97, 254, 97, 244, 123, 244, 153, 244, 179, 259, 199, 275, 199, 286, 199, 295, 189, 296, 183],
        [HIColor.controlAccent, 333, 161, 349, 206, 299, 208, 296, 182, 298, 152, 321, 146, 333, 161, 344, 165, 354, 162, 364, 153],
        [HIColor.text, 348, 198, 348, 198, 349, 199, 350, 199],
    ]

    loadView() {
        let box = new HIBox();
        this.view = box;

        box.contentInsets.maxY = 20;

        this._pathView = new SimplePathView();
        this._pathView.delegate = this;
        let pathViewFrame = box.addSubview(this._pathView);
        pathViewFrame.width = 400;
        pathViewFrame.height = 300;
        pathViewFrame.autoresizingMask = 2 | 16;  //  width, height

        this._clearButton = new HIButton("Clear", this, "clearOrLoad");
        let clearButtonFrame = box.addSubview(this._clearButton);
        clearButtonFrame.x = 100;
        clearButtonFrame.y = 320;
        clearButtonFrame.width = 90;
        clearButtonFrame.autoresizingMask = 1 | 4 | 8;  //  margins of minX, maxX, minY

        this._colorPopUp = new HIPopUpButton(this, "takeColor");
        for (let {name} of SimplePathViewController.foregroundColors) {
            this._colorPopUp.addItem(name);
        }

        let colorPopUpFrame = box.addSubview(this._colorPopUp);
        colorPopUpFrame.x = 210;
        colorPopUpFrame.y = 320;
        colorPopUpFrame.width = 90;
        colorPopUpFrame.autoresizingMask = 1 | 4 | 8;  //  margins of minX, maxX, minY

        this.takeColor(this._colorPopUp);
        this._updateDefaultColorName();
        this._loadInitialPaths();
    }

    _updateDefaultColorName() {
        let isDark = this._pathView.effectiveAppearance.isDark;
        this._colorPopUp.menu.items[0].title = isDark ? "White" : "Black";
    }

    _loadInitialPaths() {
        //  Initial paths are stored as cubic Bezier points.
        for (let path of SimplePathViewController.initialPaths) {
            this._pathView.foregroundColor = path[0];
            this._pathView.beginPath();

            let fromX = path[1];
            let fromY = path[2];

            for (let i = 3; i < path.length; i += 6) {
                let c1X = path[i];
                let c1Y = path[i + 1];
                let c2X = path[i + 2];
                let c2Y = path[i + 3];
                let toX = path[i + 4];
                let toY = path[i + 5];

                let linearLength = (
                    + Math.hypot(c1X - fromX, c1Y - fromY)
                    + Math.hypot(c2X - c1X, c2Y - c1Y)
                    + Math.hypot(toX - c2X, toY - c2Y)
                );

                let segments = Math.ceil(linearLength / 2);
                for (let j = 0; j < segments; ++j) {
                    let t = j / segments;
                    let x = Math.pow(1 - t, 3) * fromX + 3 * Math.pow(1 - t, 2) * t * c1X + 3 * (1 - t) * Math.pow(t, 2) * c2X + Math.pow(t, 3) * toX;
                    let y = Math.pow(1 - t, 3) * fromY + 3 * Math.pow(1 - t, 2) * t * c1Y + 3 * (1 - t) * Math.pow(t, 2) * c2Y + Math.pow(t, 3) * toY;
                    this._pathView.addPoint(x, y);
                }

                fromX = toX;
                fromY = toY;
            }
        }
    }

    clearOrLoad(sender) {
        if (this._pathView.isEmpty) {
            this._loadInitialPaths();
            sender.title = "Clear";
        } else {
            this._pathView.clear();
            sender.title = "Draw Hello";
        }
    }

    takeColor(sender) {
        let color = SimplePathViewController.foregroundColors[sender.indexOfSelectedItem].color;
        this._pathView.foregroundColor = color;
    }

    viewDidEndDrawing(view) {
        this._clearButton.title = "Clear";
    }

    viewDidChangeEffectiveAppearance(view) {
        this._updateDefaultColorName();
    }
}

let simplePathWindow = new HIWindow();
simplePathWindow.title = "Quick Draw";
simplePathWindow.styleMask = 1 | 2 | 8;  //  titled, closable, resizable
simplePathWindow.contentViewController = new SimplePathViewController();

export default simplePathWindow;
