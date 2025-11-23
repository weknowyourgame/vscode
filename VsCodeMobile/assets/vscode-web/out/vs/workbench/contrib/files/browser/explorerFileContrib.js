/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
export var ExplorerExtensions;
(function (ExplorerExtensions) {
    ExplorerExtensions["FileContributionRegistry"] = "workbench.registry.explorer.fileContributions";
})(ExplorerExtensions || (ExplorerExtensions = {}));
class ExplorerFileContributionRegistry extends Disposable {
    constructor() {
        super(...arguments);
        this._onDidRegisterDescriptor = this._register(new Emitter());
        this.onDidRegisterDescriptor = this._onDidRegisterDescriptor.event;
        this.descriptors = [];
    }
    /** @inheritdoc */
    register(descriptor) {
        this.descriptors.push(descriptor);
        this._onDidRegisterDescriptor.fire(descriptor);
    }
    /**
     * Creates a new instance of all registered contributions.
     */
    create(insta, container, store) {
        return this.descriptors.map(d => {
            const i = d.create(insta, container);
            store.add(i);
            return i;
        });
    }
}
export const explorerFileContribRegistry = new ExplorerFileContributionRegistry();
Registry.add("workbench.registry.explorer.fileContributions" /* ExplorerExtensions.FileContributionRegistry */, explorerFileContribRegistry);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbG9yZXJGaWxlQ29udHJpYi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2V4cGxvcmVyRmlsZUNvbnRyaWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQWdDLE1BQU0sc0NBQXNDLENBQUM7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTVFLE1BQU0sQ0FBTixJQUFrQixrQkFFakI7QUFGRCxXQUFrQixrQkFBa0I7SUFDbkMsZ0dBQTBFLENBQUE7QUFDM0UsQ0FBQyxFQUZpQixrQkFBa0IsS0FBbEIsa0JBQWtCLFFBRW5DO0FBeUJELE1BQU0sZ0NBQWlDLFNBQVEsVUFBVTtJQUF6RDs7UUFDa0IsNkJBQXdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBdUMsQ0FBQyxDQUFDO1FBQy9GLDRCQUF1QixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUM7UUFFN0QsZ0JBQVcsR0FBMEMsRUFBRSxDQUFDO0lBa0IxRSxDQUFDO0lBaEJBLGtCQUFrQjtJQUNYLFFBQVEsQ0FBQyxVQUErQztRQUM5RCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU0sQ0FBQyxLQUE0QixFQUFFLFNBQXNCLEVBQUUsS0FBc0I7UUFDekYsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMvQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNyQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2IsT0FBTyxDQUFDLENBQUM7UUFDVixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRDtBQUVELE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFHLElBQUksZ0NBQWdDLEVBQUUsQ0FBQztBQUNsRixRQUFRLENBQUMsR0FBRyxvR0FBOEMsMkJBQTJCLENBQUMsQ0FBQyJ9