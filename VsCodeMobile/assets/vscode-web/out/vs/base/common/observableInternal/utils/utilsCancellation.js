/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DebugNameData } from '../debugName.js';
import { CancellationError, CancellationTokenSource } from '../commonFacade/cancellation.js';
import { strictEquals } from '../commonFacade/deps.js';
import { autorun } from '../reactions/autorun.js';
import { Derived } from '../observables/derivedImpl.js';
import { DebugLocation } from '../debugLocation.js';
export function waitForState(observable, predicate, isError, cancellationToken) {
    if (!predicate) {
        predicate = state => state !== null && state !== undefined;
    }
    return new Promise((resolve, reject) => {
        let isImmediateRun = true;
        let shouldDispose = false;
        const stateObs = observable.map(state => {
            /** @description waitForState.state */
            return {
                isFinished: predicate(state),
                error: isError ? isError(state) : false,
                state
            };
        });
        const d = autorun(reader => {
            /** @description waitForState */
            const { isFinished, error, state } = stateObs.read(reader);
            if (isFinished || error) {
                if (isImmediateRun) {
                    // The variable `d` is not initialized yet
                    shouldDispose = true;
                }
                else {
                    d.dispose();
                }
                if (error) {
                    reject(error === true ? state : error);
                }
                else {
                    resolve(state);
                }
            }
        });
        if (cancellationToken) {
            const dc = cancellationToken.onCancellationRequested(() => {
                d.dispose();
                dc.dispose();
                reject(new CancellationError());
            });
            if (cancellationToken.isCancellationRequested) {
                d.dispose();
                dc.dispose();
                reject(new CancellationError());
                return;
            }
        }
        isImmediateRun = false;
        if (shouldDispose) {
            d.dispose();
        }
    });
}
export function derivedWithCancellationToken(computeFnOrOwner, computeFnOrUndefined) {
    let computeFn;
    let owner;
    if (computeFnOrUndefined === undefined) {
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrOwner;
        owner = undefined;
    }
    else {
        owner = computeFnOrOwner;
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrUndefined;
    }
    let cancellationTokenSource = undefined;
    return new Derived(new DebugNameData(owner, undefined, computeFn), r => {
        if (cancellationTokenSource) {
            cancellationTokenSource.dispose(true);
        }
        cancellationTokenSource = new CancellationTokenSource();
        return computeFn(r, cancellationTokenSource.token);
    }, undefined, () => cancellationTokenSource?.dispose(), strictEquals, DebugLocation.ofCaller());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHNDYW5jZWxsYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3V0aWxzL3V0aWxzQ2FuY2VsbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBYyxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsaUJBQWlCLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDaEgsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBUXBELE1BQU0sVUFBVSxZQUFZLENBQUksVUFBMEIsRUFBRSxTQUFpQyxFQUFFLE9BQXFELEVBQUUsaUJBQXFDO0lBQzFMLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNoQixTQUFTLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssS0FBSyxTQUFTLENBQUM7SUFDNUQsQ0FBQztJQUNELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDdEMsSUFBSSxjQUFjLEdBQUcsSUFBSSxDQUFDO1FBQzFCLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQztRQUMxQixNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3ZDLHNDQUFzQztZQUN0QyxPQUFPO2dCQUNOLFVBQVUsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDO2dCQUM1QixL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