/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
export var Extensions;
(function (Extensions) {
    Extensions.PreferencesEditorPane = 'workbench.registry.preferences.editorPanes';
})(Extensions || (Extensions = {}));
class PreferencesEditorPaneRegistryImpl extends Disposable {
    constructor() {
        super();
        this.descriptors = new Map();
        this._onDidRegisterPreferencesEditorPanes = this._register(new Emitter());
        this.onDidRegisterPreferencesEditorPanes = this._onDidRegisterPreferencesEditorPanes.event;
        this._onDidDeregisterPreferencesEditorPanes = this._register(new Emitter());
        this.onDidDeregisterPreferencesEditorPanes = this._onDidDeregisterPreferencesEditorPanes.event;
    }
    registerPreferencesEditorPane(descriptor) {
        if (this.descriptors.has(descriptor.id)) {
            throw new Error(`PreferencesEditorPane with id ${descriptor.id} already registered`);
        }
        this.descriptors.set(descriptor.id, descriptor);
        this._onDidRegisterPreferencesEditorPanes.fire([descriptor]);
        return {
            dispose: () => {
                if (this.descriptors.delete(descriptor.id)) {
                    this._onDidDeregisterPreferencesEditorPanes.fire([descriptor]);
                }
            }
        };
    }
    getPreferencesEditorPanes() {
        return [...this.descriptors.values()].sort((a, b) => a.order - b.order);
    }
}
Registry.add(Extensions.PreferencesEditorPane, new PreferencesEditorPaneRegistryImpl());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXNFZGl0b3JSZWdpc3RyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzRWRpdG9yUmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBRS9FLE9BQU8sRUFBUyxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUlsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFNUUsTUFBTSxLQUFXLFVBQVUsQ0FFMUI7QUFGRCxXQUFpQixVQUFVO0lBQ2IsZ0NBQXFCLEdBQUcsNENBQTRDLENBQUM7QUFDbkYsQ0FBQyxFQUZnQixVQUFVLEtBQVYsVUFBVSxRQUUxQjtBQXVERCxNQUFNLGlDQUFrQyxTQUFRLFVBQVU7SUFVekQ7UUFDQyxLQUFLLEVBQUUsQ0FBQztRQVRRLGdCQUFXLEdBQUcsSUFBSSxHQUFHLEVBQTRDLENBQUM7UUFFbEUseUNBQW9DLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBc0MsQ0FBQyxDQUFDO1FBQ2pILHdDQUFtQyxHQUFHLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxLQUFLLENBQUM7UUFFOUUsMkNBQXNDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBc0MsQ0FBQyxDQUFDO1FBQ25ILDBDQUFxQyxHQUFHLElBQUksQ0FBQyxzQ0FBc0MsQ0FBQyxLQUFLLENBQUM7SUFJbkcsQ0FBQztJQUVELDZCQUE2QixDQUFDLFVBQTRDO1FBQ3pFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsVUFBVSxDQUFDLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsb0NBQW9DLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM3RCxPQUFPO1lBQ04sT0FBTyxFQUFFLEdBQUcsRUFBRTtnQkFDYixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO29CQUM1QyxJQUFJLENBQUMsc0NBQXNDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNGLENBQUM7U0FDRCxDQUFDO0lBQ0gsQ0FBQztJQUVELHlCQUF5QjtRQUN4QixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekUsQ0FBQztDQUVEO0FBRUQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMscUJBQXFCLEVBQUUsSUFBSSxpQ0FBaUMsRUFBRSxDQUFDLENBQUMifQ==