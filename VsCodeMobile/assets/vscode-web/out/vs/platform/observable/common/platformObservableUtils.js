/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { DebugLocation, derivedOpts, observableFromEvent, observableFromEventOpts } from '../../../base/common/observable.js';
/** Creates an observable update when a configuration key updates. */
export function observableConfigValue(key, defaultValue, configurationService, debugLocation = DebugLocation.ofCaller()) {
    return observableFromEventOpts({ debugName: () => `Configuration Key "${key}"`, }, (handleChange) => configurationService.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(key)) {
            handleChange(e);
        }
    }), () => configurationService.getValue(key) ?? defaultValue, debugLocation);
}
/** Update the configuration key with a value derived from observables. */
export function bindContextKey(key, service, computeValue, debugLocation = DebugLocation.ofCaller()) {
    const boundKey = key.bindTo(service);
    const store = new DisposableStore();
    derivedOpts({ debugName: () => `Set Context Key "${key.key}"` }, reader => {
        const value = computeValue(reader);
        boundKey.set(value);
        return value;
    }, debugLocation).recomputeInitiallyAndOnChange(store);
    return store;
}
export function observableContextKey(key, contextKeyService, debugLocation = DebugLocation.ofCaller()) {
    return observableFromEvent(undefined, contextKeyService.onDidChangeContext, () => contextKeyService.getContextKeyValue(key), debugLocation);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUF3QixtQkFBbUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSXBKLHFFQUFxRTtBQUNyRSxNQUFNLFVBQVUscUJBQXFCLENBQ3BDLEdBQVcsRUFDWCxZQUFlLEVBQ2Ysb0JBQTJDLEVBQzNDLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBRXhDLE9BQU8sdUJBQXVCLENBQUMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsc0JBQXNCLEdBQUcsR0FBRyxHQUFHLEVBQ2hGLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNuRSxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqQixDQUFDO0lBQ0YsQ0FBQyxDQUFDLEVBQ0YsR0FBRyxFQUFFLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFJLEdBQUcsQ0FBQyxJQUFJLFlBQVksRUFDM0QsYUFBYSxDQUNiLENBQUM7QUFDSCxDQUFDO0FBRUQsMEVBQTBFO0FBQzFFLE1BQU0sVUFBVSxjQUFjLENBQzdCLEdBQXFCLEVBQ3JCLE9BQTJCLEVBQzNCLFlBQW9DLEVBQ3BDLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBRXhDLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUNwQyxXQUFXLENBQUMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1FBQ3pFLE1BQU0sS0FBSyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BCLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZELE9BQU8sS0FBSyxDQUFDO0FBQ2QsQ0FBQztBQUdELE1BQU0sVUFBVSxvQkFBb0IsQ0FBSSxHQUFXLEVBQUUsaUJBQXFDLEVBQUUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFDbkksT0FBTyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUksR0FBRyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDaEosQ0FBQyJ9