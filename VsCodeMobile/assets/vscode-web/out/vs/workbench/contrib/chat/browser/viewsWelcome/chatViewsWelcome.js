/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
export var ChatViewsWelcomeExtensions;
(function (ChatViewsWelcomeExtensions) {
    ChatViewsWelcomeExtensions["ChatViewsWelcomeRegistry"] = "workbench.registry.chat.viewsWelcome";
})(ChatViewsWelcomeExtensions || (ChatViewsWelcomeExtensions = {}));
class ChatViewsWelcomeContributionRegistry extends Disposable {
    constructor() {
        super(...arguments);
        this.descriptors = [];
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
    }
    register(descriptor) {
        this.descriptors.push(descriptor);
        this._onDidChange.fire();
    }
    get() {
        return this.descriptors;
    }
}
export const chatViewsWelcomeRegistry = new ChatViewsWelcomeContributionRegistry();
Registry.add("workbench.registry.chat.viewsWelcome" /* ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry */, chatViewsWelcomeRegistry);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZpZXdzV2VsY29tZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvdmlld3NXZWxjb21lL2NoYXRWaWV3c1dlbGNvbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLHFDQUFxQyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUdyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFL0UsTUFBTSxDQUFOLElBQWtCLDBCQUVqQjtBQUZELFdBQWtCLDBCQUEwQjtJQUMzQywrRkFBaUUsQ0FBQTtBQUNsRSxDQUFDLEVBRmlCLDBCQUEwQixLQUExQiwwQkFBMEIsUUFFM0M7QUFlRCxNQUFNLG9DQUFxQyxTQUFRLFVBQVU7SUFBN0Q7O1FBQ2tCLGdCQUFXLEdBQWtDLEVBQUUsQ0FBQztRQUNoRCxpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ3BELGdCQUFXLEdBQWdCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO0lBVXBFLENBQUM7SUFSTyxRQUFRLENBQUMsVUFBdUM7UUFDdEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRU0sR0FBRztRQUNULE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0NBQ0Q7QUFFRCxNQUFNLENBQUMsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLG9DQUFvQyxFQUFFLENBQUM7QUFDbkYsUUFBUSxDQUFDLEdBQUcsbUdBQXNELHdCQUF3QixDQUFDLENBQUMifQ==