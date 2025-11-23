/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// This is a facade for the observable implementation. Only import from here!
export { observableValueOpts } from './observables/observableValueOpts.js';
export { autorun, autorunDelta, autorunHandleChanges, autorunOpts, autorunWithStore, autorunWithStoreHandleChanges, autorunIterableDelta, autorunSelfDisposable } from './reactions/autorun.js';
export { disposableObservableValue } from './observables/observableValue.js';
export { derived, derivedDisposable, derivedHandleChanges, derivedOpts, derivedWithSetter, derivedWithStore } from './observables/derived.js';
export { ObservableLazy, ObservableLazyPromise, ObservablePromise, PromiseResult, } from './utils/promise.js';
export { derivedWithCancellationToken, waitForState } from './utils/utilsCancellation.js';
export { debouncedObservable, debouncedObservable2, derivedObservableWithCache, derivedObservableWithWritableCache, keepObserved, mapObservableArrayCached, observableFromPromise, recomputeInitiallyAndOnChange, signalFromObservable, wasEventTriggeredRecently, } from './utils/utils.js';
export { recordChanges, recordChangesLazy } from './changeTracker.js';
export { constObservable } from './observables/constObservable.js';
export { observableSignal } from './observables/observableSignal.js';
export { observableFromEventOpts } from './observables/observableFromEvent.js';
export { observableSignalFromEvent } from './observables/observableSignalFromEvent.js';
export { asyncTransaction, globalTransaction, subtransaction, transaction, TransactionImpl } from './transaction.js';
export { observableFromValueWithChangeEvent, ValueWithChangeEventFromObservable } from './utils/valueWithChangeEvent.js';
export { runOnChange, runOnChangeWithCancellationToken, runOnChangeWithStore } from './utils/runOnChange.js';
export { derivedConstOnceDefined, latestChangedValue } from './experimental/utils.js';
export { observableFromEvent } from './observables/observableFromEvent.js';
export { observableValue } from './observables/observableValue.js';
export { ObservableSet } from './set.js';
export { ObservableMap } from './map.js';
export { DebugLocation } from './debugLocation.js';
import { addLogger, setLogObservableFn } from './logging/logging.js';
import { ConsoleObservableLogger, logObservableToConsole } from './logging/consoleObservableLogger.js';
import { DevToolsLogger } from './logging/debugger/devToolsLogger.js';
import { env } from '../process.js';
import { _setDebugGetObservableGraph } from './observables/baseObservable.js';
import { debugGetObservableGraph } from './logging/debugGetDependencyGraph.js';
_setDebugGetObservableGraph(debugGetObservableGraph);
setLogObservableFn(logObservableToConsole);
// Remove "//" in the next line to enable logging
const enableLogging = false;
if (enableLogging) {
    addLogger(new ConsoleObservableLogger());
}
if (env && env['VSCODE_DEV_DEBUG_OBSERVABLES']) {
    // To debug observables you also need the extension "ms-vscode.debug-value-editor"
    addLogger(DevToolsLogger.getInstance());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLDZFQUE2RTtBQUU3RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsNkJBQTZCLEVBQUUsb0JBQW9CLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUVoTSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRTlJLE9BQU8sRUFBRSxjQUFjLEVBQUUscUJBQXFCLEVBQUUsaUJBQWlCLEVBQUUsYUFBYSxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDOUcsT0FBTyxFQUFFLDRCQUE0QixFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzFGLE9BQU8sRUFDTixtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSwwQkFBMEIsRUFDckUsa0NBQWtDLEVBQUUsWUFBWSxFQUFFLHdCQUF3QixFQUFFLHFCQUFxQixFQUNqRyw2QkFBNkIsRUFDN0Isb0JBQW9CLEVBQUUseUJBQXlCLEdBQy9DLE1BQU0sa0JBQWtCLENBQUM7QUFFMUIsT0FBTyxFQUE0QyxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNoSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUEwQixnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3JILE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pILE9BQU8sRUFBRSxXQUFXLEVBQUUsZ0NBQWdDLEVBQUUsb0JBQW9CLEVBQXdCLE1BQU0sd0JBQXdCLENBQUM7QUFDbkksT0FBTyxFQUFFLHVCQUF1QixFQUFFLGtCQUFrQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDekMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUN6QyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFbkQsT0FBTyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3BDLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRS9FLDJCQUEyQixDQUFDLHVCQUF1QixDQUFDLENBQUM7QUFDckQsa0JBQWtCLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUUzQyxpREFBaUQ7QUFDakQsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUV6QjtBQUVGLElBQUksYUFBYSxFQUFFLENBQUM7SUFDbkIsU0FBUyxDQUFDLElBQUksdUJBQXVCLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsOEJBQThCLENBQUMsRUFBRSxDQUFDO0lBQ2hELGtGQUFrRjtJQUNsRixTQUFTLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDekMsQ0FBQyJ9