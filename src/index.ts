declare global {

    type Nullable<T> = T | null;
    
    type ConstructorOf<T> = {
        new (...args: any[]): T;
        prototype: T;
    };
    
    type KeysOf<T, PropertyType = any> = any extends PropertyType ? keyof T : {
        [K in keyof T]: T[K] extends PropertyType ? K : never
    }[keyof T];
    
}

export * from "./HIAnimator.js";
export * from "./HIAppearance.js";
export * from "./HIBox.js";
export * from "./HIButton.js";
export * from "./HIButtonCell.js";
export * from "./HICell.js";
export * from "./HIColor.js";
export * from "./HIControl.js";
export * from "./HIImage.js";
export * from "./HILabel.js";
export * from "./HIMenu.js";
export * from "./HINotification.js";
export * from "./HIObservable.js";
export * from "./HIPopUpButton.js";
export * from "./HIPopUpButtonCell.js";
export * from "./HIResponder.js";
export * from "./HIScroller.js";
export * from "./HIScrollView.js";
export * from "./HISlider.js";
export * from "./HITrackingArea.js";
export * from "./HIUserInterfaceValidations.js";
export * from "./HIView.js";
export * from "./HIViewController.js";
export * from "./HIWindow.js";
