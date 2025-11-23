/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class Debouncer {
    constructor() {
        this._timeout = undefined;
    }
    debounce(fn, timeoutMs) {
        if (this._timeout !== undefined) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(() => {
            this._timeout = undefined;
            fn();
        }, timeoutMs);
    }
    dispose() {
        if (this._timeout !== undefined) {
            clearTimeout(this._timeout);
        }
    }
}
export class Throttler {
    constructor() {
        this._timeout = undefined;
    }
    throttle(fn, timeoutMs) {
        if (this._timeout === undefined) {
            this._timeout = setTimeout(() => {
                this._timeout = undefined;
                fn();
            }, timeoutMs);
        }
    }
    dispose() {
        if (this._timeout !== undefined) {
            clearTimeout(this._timeout);
        }
    }
}
export function deepAssign(target, source) {
    for (const key in source) {
        if (!!target[key] && typeof target[key] === 'object' && !!source[key] && typeof source[key] === 'object') {
            deepAssign(target[key], source[key]);
        }
        else {
            target[key] = source[key];
        }
    }
}
export function deepAssignDeleteNulls(target, source) {
    for (const key in source) {
        if (source[key] === null) {
            delete target[key];
        }
        else if (!!target[key] && typeof target[key] === 'object' && !!source[key] && typeof source[key] === 'object') {
            deepAssignDeleteNulls(target[key], source[key]);
        }
        else {
            target[key] = source[key];
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL2xvZ2dpbmcvZGVidWdnZXIvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsTUFBTSxPQUFPLFNBQVM7SUFBdEI7UUFDUyxhQUFRLEdBQXdCLFNBQVMsQ0FBQztJQWlCbkQsQ0FBQztJQWZPLFFBQVEsQ0FBQyxFQUFjLEVBQUUsU0FBaUI7UUFDaEQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUMvQixJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQztZQUMxQixFQUFFLEVBQUUsQ0FBQztRQUNOLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNmLENBQUM7SUFFRCxPQUFPO1FBQ04sSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0IsQ0FBQztJQUNGLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxTQUFTO0lBQXRCO1FBQ1MsYUFBUSxHQUF3QixTQUFTLENBQUM7SUFnQm5ELENBQUM7SUFkTyxRQUFRLENBQUMsRUFBYyxFQUFFLFNBQWlCO1FBQ2hELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO2dCQUMxQixFQUFFLEVBQUUsQ0FBQztZQUNOLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNmLENBQUM7SUFDRixDQUFDO0lBRUQsT0FBTztRQUNOLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFJLE1BQVMsRUFBRSxNQUFTO0lBQ2pELEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEMsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLENBQUM7SUFDRixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sVUFBVSxxQkFBcUIsQ0FBSSxNQUFTLEVBQUUsTUFBUztJQUM1RCxLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sRUFBRSxDQUFDO1FBQzFCLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzFCLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLENBQUM7YUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDakgscUJBQXFCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2pELENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQixDQUFDO0lBQ0YsQ0FBQztBQUNGLENBQUMifQ==