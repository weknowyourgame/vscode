/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IStatusbarService = createDecorator('statusbarService');
export var StatusbarAlignment;
(function (StatusbarAlignment) {
    StatusbarAlignment[StatusbarAlignment["LEFT"] = 0] = "LEFT";
    StatusbarAlignment[StatusbarAlignment["RIGHT"] = 1] = "RIGHT";
})(StatusbarAlignment || (StatusbarAlignment = {}));
export function isStatusbarEntryLocation(thing) {
    const candidate = thing;
    return typeof candidate?.location?.id === 'string' && typeof candidate.alignment === 'number';
}
export function isStatusbarEntryPriority(thing) {
    const candidate = thing;
    return (typeof candidate?.primary === 'number' || isStatusbarEntryLocation(candidate?.primary)) && typeof candidate?.secondary === 'number';
}
export const ShowTooltipCommand = {
    id: 'statusBar.entry.showTooltip',
    title: ''
};
export const StatusbarEntryKinds = ['standard', 'warning', 'error', 'prominent', 'remote', 'offline'];
export function isTooltipWithCommands(thing) {
    const candidate = thing;
    return !!candidate?.content && Array.isArray(candidate?.commands);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzYmFyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBeUIsTUFBTSw0REFBNEQsQ0FBQztBQVNwSCxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQW9CLGtCQUFrQixDQUFDLENBQUM7QUF1QnhGLE1BQU0sQ0FBTixJQUFrQixrQkFHakI7QUFIRCxXQUFrQixrQkFBa0I7SUFDbkMsMkRBQUksQ0FBQTtJQUNKLDZEQUFLLENBQUE7QUFDTixDQUFDLEVBSGlCLGtCQUFrQixLQUFsQixrQkFBa0IsUUFHbkM7QUE0QkQsTUFBTSxVQUFVLHdCQUF3QixDQUFDLEtBQWM7SUFDdEQsTUFBTSxTQUFTLEdBQUcsS0FBNEMsQ0FBQztJQUUvRCxPQUFPLE9BQU8sU0FBUyxFQUFFLFFBQVEsRUFBRSxFQUFFLEtBQUssUUFBUSxJQUFJLE9BQU8sU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLENBQUM7QUFDL0YsQ0FBQztBQXlCRCxNQUFNLFVBQVUsd0JBQXdCLENBQUMsS0FBYztJQUN0RCxNQUFNLFNBQVMsR0FBRyxLQUE0QyxDQUFDO0lBRS9ELE9BQU8sQ0FBQyxPQUFPLFNBQVMsRUFBRSxPQUFPLEtBQUssUUFBUSxJQUFJLHdCQUF3QixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLE9BQU8sU0FBUyxFQUFFLFNBQVMsS0FBSyxRQUFRLENBQUM7QUFDN0ksQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFZO0lBQzFDLEVBQUUsRUFBRSw2QkFBNkI7SUFDakMsS0FBSyxFQUFFLEVBQUU7Q0FDVCxDQUFDO0FBVUYsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQXlCLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztBQVM1SCxNQUFNLFVBQVUscUJBQXFCLENBQUMsS0FBYztJQUNuRCxNQUFNLFNBQVMsR0FBRyxLQUF5QyxDQUFDO0lBRTVELE9BQU8sQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDbkUsQ0FBQyJ9