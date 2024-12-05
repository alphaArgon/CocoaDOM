/*
 *  HIObservable.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/21.
 *  Copyright © 2024 alphaArgon.
 */

import type { HISelector } from "./HIResponder.js";


/** This class is to be subclassed and used as a mixin. For example, you have an interface `I` and
  * want to make properties of `I` observable by a method of type `T`, you can create a concrete
  * subclass of `HIObservable<I, T>`, which automatically conforms to `I`, and construct an instance
  * of the concrete subclass with copying properties from an object of `I`.
  * 
  * In the subclass, do not redeclare the properties of the observed type, otherwise the properties
  * will be shadowed and the observer will not be called. The subclass should implement the static
  * getter `[HIObserverActionKey]` and `[HIObservedKeysKey]` to specify the observer action and the
  * observed keys, respectively.
  * 
  * Do not use this class directly, and do not subclass another concrete subclass of `HIObservable`.
  */
export type HIObservable<Object, Observer> = Object & {__observable: never};

export interface HIObservableConstructor {
    new <Object, Observer>(copying: Object): HIObservable<Object, Observer>;
    readonly prototype: HIObservable<any, any>;

    /** The field with this name should be with type
      * `(object: Object, key: string, newValue: any, oldValue: any) => void`. */
    get observerAction(): HISelector;
    get observedKeys(): readonly string[];
}


const _HIObserverKey = Symbol("observer");
const _HIStorageKeysKey = Symbol("storageKeys");
const _HIAllStorageKeys: Map<PropertyKey, symbol> = new Map();

/** Sets the observer of an observable object. */
export function HIObservableSetObserver<Object, Observer>(observable: HIObservable<Object, Observer>, observer: Nullable<Observer>): void {
    (observable as any)[_HIObserverKey] = observer;
}

/** Sets a property of an observable object without notifying the observer.
  * 
  * The caller should ensure that the key is observed, otherwise it is an undefined behavior. */
export function HIObservableSetValueForKey<Object, K extends keyof Object>(observable: HIObservable<Object, any>, key: K, value: Object[K]): void {
    let storageKey = _HIAllStorageKeys.get(key)!;
    (observable as any)[storageKey] = value;
}

export const HIObservable = class HIObservable {

    public static get observerAction(): HISelector {
        throw new Error("Subclasses of `HIObservable` must implement the `observerAction` getter.");
    }

    public static get observedKeys(): readonly string[] {
        throw new Error("Subclasses of `HIObservable` must implement the `observedKeys` getter.");
    }

    public constructor(copying: any) {
        let concreteClass = new.target as HIObservableConstructor;

        //  The storage keys are stored as a static property, if initialized.
        //  `storage` means the key of the corresponding non-computed property.
        let storageKeys = Reflect.get(concreteClass, _HIStorageKeysKey) as Map<PropertyKey, symbol>;
        if (storageKeys === undefined) {
            storageKeys = new Map();
            Reflect.set(concreteClass, _HIStorageKeysKey, storageKeys);

            //  Accessing this property of HIObservable itself will throw an error, so we don’t need
            //  to check whether the subclass is concrete.
            let observerAction = concreteClass.observerAction;
            let observedKeys = concreteClass.observedKeys;
            let prototype = concreteClass.prototype;

            for (let key of observedKeys) {
                let storageKey = _HIAllStorageKeys.get(key);
                if (storageKey === undefined) {
                    storageKey = Symbol(key);
                    _HIAllStorageKeys.set(key, storageKey);
                }

                storageKeys.set(key, storageKey);
                Reflect.defineProperty(prototype, key, {
                    enumerable: true,

                    get(this: HIObservable) {
                        return Reflect.get(this, storageKey);
                    },

                    set(this: HIObservable, newValue: any) {
                        let oldValue = Reflect.get(this, storageKey);
                        Reflect.set(this, storageKey, newValue);

                        let observer = (this as any)[_HIObserverKey];
                        if (observer !== null) {
                            observer[observerAction](this, key, newValue, oldValue);
                        }
                    }
                });
            }
        }

        for (let key in copying) {
            let storageKey = storageKeys.get(key) ?? key;
            Reflect.set(this, storageKey, copying[key]);
        }

        (this as any)[_HIObserverKey] = null;
    }

} as HIObservableConstructor;
