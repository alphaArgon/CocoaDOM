/*
 *  HIUserInterfaceValidations.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/11/6.
 *  Copyright © 2024 alphaArgon.
 */

import type { HISelector } from "./HIResponder";
import type { HIWindow } from "./HIWindow";


export interface HIValidatedUserInterfaceItem {

    readonly action: Nullable<HISelector>;
}

export interface HIUserInterfaceValidations {

    /** Returns true if the item should be enabled. The target is guaranteed to be the receiver. */
    validateUserInterfaceItem(item: HIValidatedUserInterfaceItem): boolean;
}

/** Validates the item in the given window. */
export function HIValidateUserInterfaceItem(
    item: HIValidatedUserInterfaceItem & {isEnabled: boolean, target: Nullable<{}>},
    inWindow: Nullable<HIWindow>
): void {
    if (inWindow === null || item.action === null) {
        item.isEnabled = false;
        return;
    }

    let target = inWindow.targetForAction(item.action, item.target, item);
    if (target === null) {
        item.isEnabled = false;
        return;
    }

    if ("validateUserInterfaceItem" in target) {
        item.isEnabled = (target as any as HIUserInterfaceValidations).validateUserInterfaceItem(item);
        return;
    }

    item.isEnabled = true;
}
