/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../../../platform/instantiation/common/instantiation.js';
/**
 * Provides prompt services.
 */
export const IPromptsService = createDecorator('IPromptsService');
/**
 * Where the prompt is stored.
 */
export var PromptsStorage;
(function (PromptsStorage) {
    PromptsStorage["local"] = "local";
    PromptsStorage["user"] = "user";
    PromptsStorage["extension"] = "extension";
})(PromptsStorage || (PromptsStorage = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0c1NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L3NlcnZpY2UvcHJvbXB0c1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFRaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBTW5HOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLGVBQWUsQ0FBa0IsaUJBQWlCLENBQUMsQ0FBQztBQUVuRjs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBSVg7QUFKRCxXQUFZLGNBQWM7SUFDekIsaUNBQWUsQ0FBQTtJQUNmLCtCQUFhLENBQUE7SUFDYix5Q0FBdUIsQ0FBQTtBQUN4QixDQUFDLEVBSlcsY0FBYyxLQUFkLGNBQWMsUUFJekIifQ==