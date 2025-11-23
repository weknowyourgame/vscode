/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../commonFacade/deps.js';
import { observableFromEvent } from '../observables/observableFromEvent.js';
export class ValueWithChangeEventFromObservable {
    constructor(observable) {
        this.observable = observable;
    }
    get onDidChange() {
        return Event.fromObservableLight(this.observable);
    }
    get value() {
        return this.observable.get();
    }
}
export function observableFromValueWithChangeEvent(owner, value) {
    if (value instanceof ValueWithChangeEventFromObservable) {
        return value.observable;
    }
    return observableFromEvent(owner, value.onDidChange, () => value.value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsdWVXaXRoQ2hhbmdlRXZlbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3V0aWxzL3ZhbHVlV2l0aENoYW5nZUV2ZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQXlCLE1BQU0seUJBQXlCLENBQUM7QUFFdkUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFNUUsTUFBTSxPQUFPLGtDQUFrQztJQUM5QyxZQUE0QixVQUEwQjtRQUExQixlQUFVLEdBQVYsVUFBVSxDQUFnQjtJQUN0RCxDQUFDO0lBRUQsSUFBSSxXQUFXO1FBQ2QsT0FBTyxLQUFLLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDOUIsQ0FBQztDQUNEO0FBRUQsTUFBTSxVQUFVLGtDQUFrQyxDQUFJLEtBQWlCLEVBQUUsS0FBK0I7SUFDdkcsSUFBSSxLQUFLLFlBQVksa0NBQWtDLEVBQUUsQ0FBQztRQUN6RCxPQUFPLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUNELE9BQU8sbUJBQW1CLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pFLENBQUMifQ==