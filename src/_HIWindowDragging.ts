/*
 *  _HIWindowDragging.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/18.
 *  Copyright © 2024 alphaArgon.
 */

import { _HIWindowDragType } from "./_HIThemeFrame.js";
import type { HIRect, HISize } from "./HIGeometry.js";


export function _HIResizingCursor(type: _HIWindowDragType): string {
    switch (type % 4) {
    case 0: return "nwse-resize";
    case 1: return "ns-resize";
    case 2: return "nesw-resize";
    case 3: return "ew-resize";
    case 4: return "nwse-resize";
    default: return "default";
    }
}

export function _HIWindowDragFrame(
    frame: HIRect, type: _HIWindowDragType, symmetric: boolean,
    dx: number, dy: number, ε: number
): string {
    switch (type) {
    case _HIWindowDragType.move:
        frame.x += dx; frame.y += dy;
        return "";
    case _HIWindowDragType.resizeNW:
        if (symmetric) {frame.x += dx; frame.y += dy; frame.width -= dx * 2; frame.height -= dy * 2;}
        else {frame.x += dx; frame.y += dy; frame.width -= dx; frame.height -= dy;}
        if (dx < -ε && dy < -ε) {return "se-resize";}
        if (dx > ε && dy > ε) {return "nw-resize";}
        return "nwse-resize";
    case _HIWindowDragType.resizeN:
        if (symmetric) {frame.y += dy; frame.height -= dy * 2;}
        else {frame.y += dy; frame.height -= dy;}
        if (dy < -ε) {return "s-resize";}
        if (dy > ε) {return "n-resize";}
        return "ns-resize";
    case _HIWindowDragType.resizeNE:
        if (symmetric) {frame.x -= dx; frame.y += dy; frame.width += dx * 2; frame.height -= dy * 2;}
        else {frame.y += dy; frame.width += dx; frame.height -= dy;}
        if (dx > ε && dy < -ε) {return "sw-resize";}
        if (dx < -ε && dy > ε) {return "ne-resize";}
        return "nesw-resize";
    case _HIWindowDragType.resizeE:
        if (symmetric) {frame.x -= dx; frame.width += dx * 2;}
        else {frame.width += dx;}
        if (dx > ε) {return "w-resize";}
        if (dx < -ε) {return "e-resize";}
        return "ew-resize";
    case _HIWindowDragType.resizeSE:
        if (symmetric) {frame.x -= dx; frame.y -= dy; frame.width += dx * 2; frame.height += dy * 2;}
        else {frame.width += dx; frame.height += dy;}
        if (dx > ε && dy > ε) {return "nw-resize";}
        if (dx < -ε && dy < -ε) {return "se-resize";}
        return "nwse-resize";
    case _HIWindowDragType.resizeS:
        if (symmetric) {frame.y -= dy; frame.height += dy * 2;}
        else {frame.height += dy;}
        if (dy > ε) {return "n-resize";}
        if (dy < -ε) {return "s-resize";}
        return "ns-resize";
    case _HIWindowDragType.resizeSW:
        if (symmetric) {frame.x += dx; frame.y -= dy; frame.width -= dx * 2; frame.height += dy * 2;}
        else {frame.x += dx; frame.width -= dx; frame.height += dy;}
        if (dx < -ε && dy > ε) {return "ne-resize";}
        if (dx > ε && dy < -ε) {return "sw-resize";}
        return "nesw-resize";
    case _HIWindowDragType.resizeW:
        if (symmetric) {frame.x += dx; frame.width -= dx * 2;}
        else {frame.x += dx; frame.width -= dx;}
        if (dx < -ε) {return "e-resize";}
        if (dx > ε) {return "w-resize";}
        return "ew-resize";
    }
}

export function _HIWindowFixFrame(
    frame: HIRect, type: _HIWindowDragType, symmetric: boolean,
    minSize: Readonly<HISize>, maxSize: Readonly<HISize>
): void {
    if (frame.width < minSize.width || frame.width > maxSize.width) {
        let width = frame.width < minSize.width ? minSize.width : maxSize.width;
        if (symmetric) {
            let dx = (width - frame.width) / 2;
            frame.x -= dx;
            frame.width = width;
        } else switch (type) {
        case _HIWindowDragType.resizeNW:
        case _HIWindowDragType.resizeW:
        case _HIWindowDragType.resizeSW:
            frame.x += frame.width - width;
            //  Fall through.
        default:
            frame.width = width;
            break;
        }
    }

    if (frame.height < minSize.height || frame.height > maxSize.height) {
        let height = frame.height < minSize.height ? minSize.height : maxSize.height;
        if (symmetric) {
            let dy = (height - frame.height) / 2;
            frame.y -= dy;
            frame.height = height;
        } else switch (type) {
        case _HIWindowDragType.resizeNW:
        case _HIWindowDragType.resizeN:
        case _HIWindowDragType.resizeNE:
            frame.y += frame.height - height;
            //  Fall through.
        default:
            frame.height = height;
            break;
        }
    }
}
