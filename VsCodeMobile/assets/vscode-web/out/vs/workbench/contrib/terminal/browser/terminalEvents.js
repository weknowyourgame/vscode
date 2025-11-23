/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DynamicListEventMultiplexer, Event, EventMultiplexer } from '../../../../base/common/event.js';
import { DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
export function createInstanceCapabilityEventMultiplexer(currentInstances, onAddInstance, onRemoveInstance, capabilityId, getEvent) {
    const store = new DisposableStore();
    const multiplexer = store.add(new EventMultiplexer());
    const capabilityListeners = store.add(new DisposableMap());
    function addCapability(instance, capability) {
        const listener = multiplexer.add(Event.map(getEvent(capability), data => ({ instance, data })));
        let instanceCapabilityListeners = capabilityListeners.get(instance.instanceId);
        if (!instanceCapabilityListeners) {
            instanceCapabilityListeners = new DisposableMap();
            capabilityListeners.set(instance.instanceId, instanceCapabilityListeners);
        }
        instanceCapabilityListeners.set(capability, listener);
    }
    // Existing instances
    for (const instance of currentInstances) {
        const capability = instance.capabilities.get(capabilityId);
        if (capability) {
            addCapability(instance, capability);
        }
    }
    // Removed instances
    store.add(onRemoveInstance(instance => {
        capabilityListeners.deleteAndDispose(instance.instanceId);
    }));
    // Added capabilities
    const addCapabilityMultiplexer = store.add(new DynamicListEventMultiplexer(currentInstances, onAddInstance, onRemoveInstance, instance => Event.map(instance.capabilities.createOnDidAddCapabilityOfTypeEvent(capabilityId), changeEvent => ({ instance, changeEvent }))));
    store.add(addCapabilityMultiplexer.event(e => {
        addCapability(e.instance, e.changeEvent);
    }));
    // Removed capabilities
    const removeCapabilityMultiplexer = store.add(new DynamicListEventMultiplexer(currentInstances, onAddInstance, onRemoveInstance, instance => Event.map(instance.capabilities.createOnDidRemoveCapabilityOfTypeEvent(capabilityId), changeEvent => ({ instance, changeEvent }))));
    store.add(removeCapabilityMultiplexer.event(e => {
        capabilityListeners.get(e.instance.instanceId)?.deleteAndDispose(e.changeEvent);
    }));
    return {
        dispose: () => store.dispose(),
        event: multiplexer.event
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFdmVudHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEV2ZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFnQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ3RJLE9BQU8sRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFHbkcsTUFBTSxVQUFVLHdDQUF3QyxDQUN2RCxnQkFBcUMsRUFDckMsYUFBdUMsRUFDdkMsZ0JBQTBDLEVBQzFDLFlBQWUsRUFDZixRQUFpRTtJQUVqRSxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBQ3BDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxnQkFBZ0IsRUFBNEMsQ0FBQyxDQUFDO0lBQ2hHLE1BQU0sbUJBQW1CLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGFBQWEsRUFBcUUsQ0FBQyxDQUFDO0lBRTlILFNBQVMsYUFBYSxDQUFDLFFBQTJCLEVBQUUsVUFBeUM7UUFDNUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEcsSUFBSSwyQkFBMkIsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9FLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ2xDLDJCQUEyQixHQUFHLElBQUksYUFB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