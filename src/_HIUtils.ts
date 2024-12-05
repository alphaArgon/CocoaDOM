/*
 *  HIUtils.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/14.
 *  Copyright © 2024 alphaArgon.
 */


let _HIRandomIDSeed1 = 0;
let _HIRandomIDSeed2 = 0;

export function HIMakeLCGID() {
    //  Use LCG to generate two random number, and then concatenate them.
    let x = _HIRandomIDSeed1;
    x = (x * 1664525 + 1013904223) & 0xFFFFFFFF;
    _HIRandomIDSeed1 = x;

    let y = _HIRandomIDSeed2;
    y = (y * 1103515245 + 12345) & 0xFFFFFFFF;
    _HIRandomIDSeed2 = y;

    if (x < 0) {x = x >>> 0;}
    if (y < 0) {y = y >>> 0;}

    return y.toString(16).padStart(8, "0") + x.toString(16).padStart(8, "0");
}


const _HIReadonlyProxyMap = new WeakMap<object, object>();

/** Returns a readonly proxy of the given object.
  * 
  * The returned object is a shallow copy (by Object.create) of the given object, and is frozen.
  * If the object is created before, the same readonly object will be returned.
  * 
  * Note that the returned object is not a JavaScript `Proxy` object. */
export function HIGetReadonlyProxy<T extends object>(object: T): Readonly<T> {
    let proxy = _HIReadonlyProxyMap.get(object) as Readonly<T> | undefined;
    if (proxy === undefined) {
        proxy = Object.freeze(Object.create(object)) as Readonly<T>;
        _HIReadonlyProxyMap.set(object, proxy);
    }
    return proxy;
}


/** A decorator for a property getter, which will evaluate the value using the getter on the first
  * access, and then replace the getter with a normal property.
  * 
  * The property should not be overridden by a subclass, otherwise the getter may be called multiple
  * times. */
export function HISavedGetter(target: {}, key: PropertyKey, descriptor: PropertyDescriptor) {
    let getter = descriptor.get;
    descriptor.get = function () {
        let value = getter!.call(target);
        Object.defineProperty(target, key, {value, configurable: true});
        return value;
    }
}


export function *HIBFSTraversal<T>(root: T, childrenKey: KeysOf<T, Iterable<T>>): Generator<T> {
    let queue = [root];
    do {
        let node = queue.shift()!;
        yield node;
        queue.push(...node[childrenKey] as Iterable<T>);
    } while (queue.length);
}

export function *HIPreOrderTraversal<T>(root: T, childrenKey: KeysOf<T, Iterable<T>>): Generator<T> {
    yield root;
    for (let child of root[childrenKey] as Iterable<T>) {
        yield *HIPreOrderTraversal(child, childrenKey);
    }
}

export function *HIPostOrderTraversal<T>(root: T, childrenKey: KeysOf<T, Iterable<T>>): Generator<T> {
    for (let child of root[childrenKey] as Iterable<T>) {
        yield *HIPostOrderTraversal(child, childrenKey);
    }
    yield root;
}


/** Returns the first element that matches the predicate by traversing the DOM tree upwards from the
  * given descendant element. If `limit` is provided and reached, the search stops and returns null. */
export function HIFindDOMUpwards(descendant: Element, predicate: (element: Element) => boolean, limit?: Element): Nullable<Element> {
    let limitElement = limit ?? null;
    let element = descendant as Nullable<Element>;
    while (element !== null && element !== limitElement) {
        if (predicate(element)) {return element;}
        element = element.parentElement;
    }
    return null;
}


/** Returns the direct child element of the given `parent` that is an ancestor of the given 
  * `descendant`, or null if no such element exists.
  *
  * This function is equivalent to the following code, but more efficient:
  * 
  *     HIFindDOMUpwards(descendant, (element) => element === parent), parent)
  */
export function HIFindDirectChildDOMFrom(descendant: Element, parent: Element): Nullable<Element> {
    let current = descendant as Nullable<Element>;
    let currentParent = current!.parentElement;
    while (currentParent !== null && currentParent !== parent) {
        current = currentParent;
        currentParent = current.parentElement;
    }
    return currentParent === parent ? current : null;
}


export function HISetDOMAttribute(dom: Nullable<Element>, name: string, value: Nullable<string> = "") {
    if (dom === null) {return;}
    value === null ? dom.removeAttribute(name) : dom.setAttribute(name, value);
}


export function HISetDOMHasAttribute(dom: Nullable<Element>, name: string, value: boolean) {
    if (dom === null) {return;}
    value ? dom.setAttribute(name, "") : dom.removeAttribute(name);
}


export function HISetDOMState(dom: Nullable<Element>, state: -1 | 0 | 1): void {
    if (dom === null) {return;}
    switch (state) {
    case -1:    dom.setAttribute("state", "mixed"); break;
    case 0:     dom.removeAttribute("state"); break;
    case 1:     dom.setAttribute("state", "on"); break;
    }
}


export function HISetDOMAlignment(dom: Nullable<Element>, alignment: 0 | 1 | 2 | 3 | 4): void {
    if (dom === null) {return;}
    switch (alignment) {
    case 0:     dom.removeAttribute("alignment"); break;
    case 1:     dom.setAttribute("alignment", "left"); break;
    case 2:     dom.setAttribute("alignment", "right"); break;
    case 3:     dom.setAttribute("alignment", "center"); break;
    case 4:     dom.setAttribute("alignment", "justified"); break;
    }
}
