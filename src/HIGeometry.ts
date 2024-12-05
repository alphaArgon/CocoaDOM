/*
 *  HIGeometry.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/5.
 *  Copyright © 2024 alphaArgon.
 */


export type HIPoint = {
    x: number;
    y: number;
}

export type HISize = {
    width: number;
    height: number;
}

export type HIRect = {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type HIEdgeInsets = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}


export function HIPointMake(x: number, y: number): HIPoint {
    return {x, y};
}

export function HISizeMake(width: number, height: number): HISize {
    return {width, height};
}

export function HIRectMake(x: number, y: number, width: number, height: number): HIRect {
    return {x, y, width, height};
}

export function HIEdgeInsetsMake(minX: number, minY: number, maxX: number, maxY: number): HIEdgeInsets {
    return {minX, minY, maxX, maxY};
}


export function HIRectIntersects(rect1: Readonly<HIRect>, rect2: Readonly<HIRect>): boolean {
    let maxX1 = rect1.x + rect1.width;
    let maxY1 = rect1.y + rect1.height;
    let maxX2 = rect2.x + rect2.width;
    let maxY2 = rect2.y + rect2.height;
    return rect1.x < maxX2 && maxX1 > rect2.x && rect1.y < maxY2 && maxY1 > rect2.y;
}

export function HIRectUnion(rect1: Readonly<HIRect>, rect2: Readonly<HIRect>): HIRect {
    let minX = Math.min(rect1.x, rect2.x);
    let minY = Math.min(rect1.y, rect2.y);
    let maxX = Math.max(rect1.x + rect1.width, rect2.x + rect2.width);
    let maxY = Math.max(rect1.y + rect1.height, rect2.y + rect2.height);
    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
}

export function HIRectInset(rect: Readonly<HIRect>, dx: number, dy: number): HIRect {
    return {x: rect.x + dx, y: rect.y + dy, width: rect.width - 2 * dx, height: rect.height - 2 * dy};
}

export function HIRectOffset(rect: Readonly<HIRect>, dx: number, dy: number): HIRect {
    return {x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height};
}
