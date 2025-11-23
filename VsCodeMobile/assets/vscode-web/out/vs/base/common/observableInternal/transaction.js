/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { handleBugIndicatingErrorRecovery } from './base.js';
import { getFunctionName } from './debugName.js';
import { getLogger } from './logging/logging.js';
/**
 * Starts a transaction in which many observables can be changed at once.
 * {@link fn} should start with a JS Doc using `@description` to give the transaction a debug name.
 * Reaction run on demand or when the transaction ends.
 */
export function transaction(fn, getDebugName) {
    const tx = new TransactionImpl(fn, getDebugName);
    try {
        fn(tx);
    }
    finally {
        tx.finish();
    }
}
let _globalTransaction = undefined;
export function globalTransaction(fn) {
    if (_globalTransaction) {
        fn(_globalTransaction);
    }
    else {
        const tx = new TransactionImpl(fn, undefined);
        _globalTransaction = tx;
        try {
            fn(tx);
        }
        finally {
            tx.finish(); // During finish, more actions might be added to the transaction.
            // Which is why we only clear the global transaction after finish.
            _globalTransaction = undefined;
        }
    }
}
/** @deprecated */
export async function asyncTransaction(fn, getDebugName) {
    const tx = new TransactionImpl(fn, getDebugName);
    try {
        await fn(tx);
    }
    finally {
        tx.finish();
    }
}
/**
 * Allows to chain transactions.
 */
export function subtransaction(tx, fn, getDebugName) {
    if (!tx) {
        transaction(fn, getDebugName);
    }
    else {
        fn(tx);
    }
}
export class TransactionImpl {
    constructor(_fn, _getDebugName) {
        this._fn = _fn;
        this._getDebugName = _getDebugName;
        this._updatingObservers = [];
        getLogger()?.handleBeginTransaction(this);
    }
    getDebugName() {
        if (this._getDebugName) {
            return this._getDebugName();
        }
        return getFunctionName(this._fn);
    }
    updateObserver(observer, observable) {
        if (!this._updatingObservers) {
            // This happens when a transaction is used in a callback or async function.
            // If an async transaction is used, make sure the promise awaits all users of the transaction (e.g. no race).
            handleBugIndicatingErrorRecovery('Transaction already finished!');
            // Error recovery
            transaction(tx => {
                tx.updateObserver(observer, observable);
            });
            return;
        }
        // When this gets called while finish is active, they will still get considered
        this._updatingObservers.push({ observer, observable });
        observer.beginUpdate(observable);
    }
    finish() {
        const updatingObservers = this._updatingObservers;
        if (!updatingObservers) {
            handleBugIndicatingErrorRecovery('transaction.finish() has already been called!');
            return;
        }
        for (let i = 0; i < updatingObservers.length; i++) {
            const { observer, observable } = updatingObservers[i];
            observer.endUpdate(observable);
        }
        // Prevent anyone from updating observers from now on.
        this._updatingObservers = null;
        getLogger()?.handleEndTransaction(this);
    }
    debugGetUpdatingObservers() {
        return this._updatingObservers;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3RyYW5zYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBd0MsTUFBTSxXQUFXLENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUVqRDs7OztHQUlHO0FBRUgsTUFBTSxVQUFVLFdBQVcsQ0FBQyxFQUE4QixFQUFFLFlBQTJCO0lBQ3RGLE1BQU0sRUFBRSxHQUFHLElBQUksZUFBZSxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNqRCxJQUFJLENBQUM7UUFDSixFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDUixDQUFDO1lBQVMsQ0FBQztRQUNWLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNiLENBQUM7QUFDRixDQUFDO0FBQ0QsSUFBSSxrQkFBa0IsR0FBNkIsU0FBUyxDQUFDO0FBRTdELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxFQUE4QjtJQUMvRCxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDeEIsRUFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDeEIsQ0FBQztTQUFNLENBQUM7UUFDUCxNQUFNLEVBQUUsR0FBRyxJQUFJLGVBQWUsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDOUMsa0JBQWtCLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQztZQUNKLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNSLENBQUM7Z0JBQVMsQ0FBQztZQUNWLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLGlFQUFpRTtZQUU5RSxr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