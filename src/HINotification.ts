/*
 *  HINotification.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/30.
 *  Copyright © 2024 alphaArgon.
 */

import { HISavedGetter } from "./_HIUtils.js";
import { HISelector } from "./HIResponder.js";


export type HINotification<UserInfo> = {
    name: HINotificationName<any>;
    sender: any;
    userInfo: UserInfo;
}


export type HINotificationName<UserInfo> = string & {__userInfo?: UserInfo};


export type HINotificationObserverMethod = (notification: HINotification<any>) => void;


const _HIAnonymousSender = Object.create(null);


export class HINotificationCenter {

    private _observations: WeakMap<any, Map<string, Map<any, HISelector>>>  //  {sender: {name: {observer: selector}}}

    private constructor() {
        this._observations = new WeakMap();
    }

    @HISavedGetter
    public static get default(): HINotificationCenter {
        return new HINotificationCenter();
    }

    public addObserver<T>(observer: T, selector: HISelector & KeysOf<T, HINotificationObserverMethod>, name: string, sender?: Nullable<any>): void {
        sender ??= _HIAnonymousSender;

        let observation = this._observations.get(sender);
        if (observation === undefined) {
            this._observations.set(sender, observation = new Map());
        }

        let observers = observation.get(name);
        if (observers === undefined) {
            observation.set(name, observers = new Map());
        }

        observers.set(observer, selector);
    }

    public removeObserver(observer: any, name: string, sender?: Nullable<any>): void {
        sender ??= _HIAnonymousSender;

        let observation = this._observations.get(sender);
        if (observation === undefined) {return;}

        let observers = observation.get(name);
        if (observers === undefined) {return;}

        observers.delete(observer);

        //  We don’t need to clean up observation from anonymous sender.
        if (sender === _HIAnonymousSender) {return;}

        if (observers.size === 0) {
            observation.delete(name);
        }

        if (observation.size === 0) {
            this._observations.delete(sender);
        }
    }

    public post(name: HINotificationName<void>, sender: Nullable<any>): void;
    public post(name: HINotificationName<undefined>, sender: Nullable<any>): void;
    public post<T>(name: HINotificationName<T>, sender: Nullable<any>, userInfo: T): void;
    public post<T>(name: HINotificationName<T>, sender: Nullable<any>, userInfo?: T): void {
        let notification = Object.freeze({name, sender, userInfo});

        let senders = (sender ?? _HIAnonymousSender) === _HIAnonymousSender ? [_HIAnonymousSender] : [sender, _HIAnonymousSender];
        for (let sender of senders) {
            let observation = this._observations.get(sender);
            if (observation === undefined) {continue;}

            let observers = observation.get(name);
            if (observers === undefined) {continue;}

            for (let [observer, selector] of observers) {
                observer[selector](notification);
            }
        }
    }
}
