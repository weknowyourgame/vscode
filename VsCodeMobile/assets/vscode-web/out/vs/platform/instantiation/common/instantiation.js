/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// ------ internal util
export var _util;
(function (_util) {
    _util.serviceIds = new Map();
    _util.DI_TARGET = '$di$target';
    _util.DI_DEPENDENCIES = '$di$dependencies';
    function getServiceDependencies(ctor) {
        return ctor[_util.DI_DEPENDENCIES] || [];
    }
    _util.getServiceDependencies = getServiceDependencies;
})(_util || (_util = {}));
export const IInstantiationService = createDecorator('instantiationService');
function storeServiceDependency(id, target, index) {
    if (target[_util.DI_TARGET] === target) {
        target[_util.DI_DEPENDENCIES].push({ id, index });
    }
    else {
        target[_util.DI_DEPENDENCIES] = [{ id, index }];
        target[_util.DI_TARGET] = target;
    }
}
/**
 * The *only* valid way to create a {{ServiceIdentifier}}.
 */
export function createDecorator(serviceId) {
    if (_util.serviceIds.has(serviceId)) {
        return _util.serviceIds.get(serviceId);
    }
    const id = function (target, key, index) {
        if (arguments.length !== 3) {
            throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
        }
        storeServiceDependency(id, target, index);
    };
    id.toString = () => serviceId;
    _util.serviceIds.set(serviceId, id);
    return id;
}
export function refineServiceDecorator(serviceIdentifier) {
    return serviceIdentifier;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFudGlhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLHVCQUF1QjtBQUV2QixNQUFNLEtBQVcsS0FBSyxDQWVyQjtBQWZELFdBQWlCLEtBQUs7SUFFUixnQkFBVSxHQUFHLElBQUksR0FBRyxFQUFrQyxDQUFDO0lBRXZELGVBQVMsR0FBRyxZQUFZLENBQUM7SUFDekIscUJBQWUsR0FBRyxrQkFBa0IsQ0FBQztJQUVsRCxTQUFnQixzQkFBc0IsQ0FBQyxJQUFtQjtRQUN6RCxPQUFPLElBQUksQ0FBQyxNQUFBLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRmUsNEJBQXNCLHlCQUVyQyxDQUFBO0FBTUYsQ0FBQyxFQWZnQixLQUFLLEtBQUwsS0FBSyxRQWVyQjtBQWVELE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGVBQWUsQ0FBd0Isc0JBQXNCLENBQUMsQ0FBQztBQXdEcEcsU0FBUyxzQkFBc0IsQ0FBQyxFQUE4QixFQUFFLE1BQWdCLEVBQUUsS0FBYTtJQUM5RixJQUFLLE1BQThCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLE1BQU0sRUFBRSxDQUFDO1FBQ2hFLE1BQThCLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzVFLENBQUM7U0FBTSxDQUFDO1FBQ04sTUFBOEIsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3hFLE1BQThCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztJQUMzRCxDQUFDO0FBQ0YsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBSSxTQUFpQjtJQUVuRCxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7UUFDckMsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUUsQ0FBQztJQUN6QyxDQUFDO0lBRUQsTUFBTSxFQUFFLEdBQUcsVUFBVSxNQUFnQixFQUFFLEdBQVcsRUFBRSxLQUFhO1FBQ2hFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLGtFQUFrRSxDQUFDLENBQUM7UUFDckYsQ0FBQztRQUNELHNCQUFzQixDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0MsQ0FBeUIsQ0FBQztJQUUxQixFQUFFLENBQUMsUUFBUSxHQUFHLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQztJQUU5QixLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDcEMsT0FBTyxFQUFFLENBQUM7QUFDWCxDQUFDO0FBRUQsTUFBTSxVQUFVLHNCQUFzQixDQUFtQixpQkFBd0M7SUFDaEcsT0FBNkIsaUJBQWlCLENBQUM7QUFDaEQsQ0FBQyJ9