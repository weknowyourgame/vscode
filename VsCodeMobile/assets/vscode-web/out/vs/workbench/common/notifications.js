/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NoOpNotification, Severity, NotificationsFilter, NotificationPriority, isNotificationSource } from '../../platform/notification/common/notification.js';
import { toErrorMessage, isErrorWithActions } from '../../base/common/errorMessage.js';
import { Event, Emitter } from '../../base/common/event.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { isCancellationError } from '../../base/common/errors.js';
import { Action } from '../../base/common/actions.js';
import { equals } from '../../base/common/arrays.js';
import { parseLinkedText } from '../../base/common/linkedText.js';
import { mapsStrictEqualIgnoreOrder } from '../../base/common/map.js';
export var NotificationChangeType;
(function (NotificationChangeType) {
    /**
     * A notification was added.
     */
    NotificationChangeType[NotificationChangeType["ADD"] = 0] = "ADD";
    /**
     * A notification changed. Check `detail` property
     * on the event for additional information.
     */
    NotificationChangeType[NotificationChangeType["CHANGE"] = 1] = "CHANGE";
    /**
     * A notification expanded or collapsed.
     */
    NotificationChangeType[NotificationChangeType["EXPAND_COLLAPSE"] = 2] = "EXPAND_COLLAPSE";
    /**
     * A notification was removed.
     */
    NotificationChangeType[NotificationChangeType["REMOVE"] = 3] = "REMOVE";
})(NotificationChangeType || (NotificationChangeType = {}));
export var StatusMessageChangeType;
(function (StatusMessageChangeType) {
    StatusMessageChangeType[StatusMessageChangeType["ADD"] = 0] = "ADD";
    StatusMessageChangeType[StatusMessageChangeType["REMOVE"] = 1] = "REMOVE";
})(StatusMessageChangeType || (StatusMessageChangeType = {}));
export class NotificationHandle extends Disposable {
    constructor(item, onClose) {
        super();
        this.item = item;
        this.onClose = onClose;
        this._onDidClose = this._register(new Emitter());
        this.onDidClose = this._onDidClose.event;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.onDidChangeVisibility = this._onDidChangeVisibility.event;
        this.registerListeners();
    }
    registerListeners() {
        // Visibility
        this._register(this.item.onDidChangeVisibility(visible => this._onDidChangeVisibility.fire(visible)));
        // Closing
        Event.once(this.item.onDidClose)(() => {
            this._onDidClose.fire();
            this.dispose();
        });
    }
    get progress() {
        return this.item.progress;
    }
    updateSeverity(severity) {
        this.item.updateSeverity(severity);
    }
    updateMessage(message) {
        this.item.updateMessage(message);
    }
    updateActions(actions) {
        this.item.updateActions(actions);
    }
    close() {
        this.onClose(this.item);
        this.dispose();
    }
}
export class NotificationsModel extends Disposable {
    constructor() {
        super(...arguments);
        this._onDidChangeNotification = this._register(new Emitter());
        this.onDidChangeNotification = this._onDidChangeNotification.event;
        this._onDidChangeStatusMessage = this._register(new Emitter());
        this.onDidChangeStatusMessage = this._onDidChangeStatusMessage.event;
        this._onDidChangeFilter = this._register(new Emitter());
        this.onDidChangeFilter = this._onDidChangeFilter.event;
        this._notifications = [];
        this.filter = {
            global: NotificationsFilter.OFF,
            sources: new Map()
        };
    }
    static { this.NO_OP_NOTIFICATION = new NoOpNotification(); }
    get notifications() { return this._notifications; }
    get statusMessage() { return this._statusMessage; }
    setFilter(filter) {
        let globalChanged = false;
        if (typeof filter.global === 'number') {
            globalChanged = this.filter.global !== filter.global;
            this.filter.global = filter.global;
        }
        let sourcesChanged = false;
        if (filter.sources) {
            sourcesChanged = !mapsStrictEqualIgnoreOrder(this.filter.sources, filter.sources);
            this.filter.sources = filter.sources;
        }
        if (globalChanged || sourcesChanged) {
            this._onDidChangeFilter.fire({
                global: globalChanged ? filter.global : undefined,
                sources: sourcesChanged ? filter.sources : undefined
            });
        }
    }
    addNotification(notification) {
        const item = this.createViewItem(notification);
        if (!item) {
            return NotificationsModel.NO_OP_NOTIFICATION; // return early if this is a no-op
        }
        // Deduplicate
        const duplicate = this.findNotification(item);
        duplicate?.close();
        // Add to list as first entry
        this._notifications.splice(0, 0, item);
        // Events
        this._onDidChangeNotification.fire({ item, index: 0, kind: 0 /* NotificationChangeType.ADD */ });
        // Wrap into handle
        return new NotificationHandle(item, item => this.onClose(item));
    }
    onClose(item) {
        const liveItem = this.findNotification(item);
        if (liveItem && liveItem !== item) {
            liveItem.close(); // item could have been replaced with another one, make sure to close the live item
        }
        else {
            item.close(); // otherwise just close the item that was passed in
        }
    }
    findNotification(item) {
        return this._notifications.find(notification => notification.equals(item));
    }
    createViewItem(notification) {
        const item = NotificationViewItem.create(notification, this.filter);
        if (!item) {
            return undefined;
        }
        // Item Events
        const fireNotificationChangeEvent = (kind, detail) => {
            const index = this._notifications.indexOf(item);
            if (index >= 0) {
                this._onDidChangeNotification.fire({ item, index, kind, detail });
            }
        };
        const itemExpansionChangeListener = item.onDidChangeExpansion(() => fireNotificationChangeEvent(2 /* NotificationChangeType.EXPAND_COLLAPSE */));
        const itemContentChangeListener = item.onDidChangeContent(e => fireNotificationChangeEvent(1 /* NotificationChangeType.CHANGE */, e.kind));
        Event.once(item.onDidClose)(() => {
            itemExpansionChangeListener.dispose();
            itemContentChangeListener.dispose();
            const index = this._notifications.indexOf(item);
            if (index >= 0) {
                this._notifications.splice(index, 1);
                this._onDidChangeNotification.fire({ item, index, kind: 3 /* NotificationChangeType.REMOVE */ });
            }
        });
        return item;
    }
    showStatusMessage(message, options) {
        const item = StatusMessageViewItem.create(message, options);
        if (!item) {
            return { close: () => { } };
        }
        this._statusMessage = item;
        this._onDidChangeStatusMessage.fire({ kind: 0 /* StatusMessageChangeType.ADD */, item });
        return {
            close: () => {
                if (this._statusMessage === item) {
                    this._statusMessage = undefined;
                    this._onDidChangeStatusMessage.fire({ kind: 1 /* StatusMessageChangeType.REMOVE */, item });
                }
            }
        };
    }
}
export function isNotificationViewItem(obj) {
    return obj instanceof NotificationViewItem;
}
export var NotificationViewItemContentChangeKind;
(function (NotificationViewItemContentChangeKind) {
    NotificationViewItemContentChangeKind[NotificationViewItemContentChangeKind["SEVERITY"] = 0] = "SEVERITY";
    NotificationViewItemContentChangeKind[NotificationViewItemContentChangeKind["MESSAGE"] = 1] = "MESSAGE";
    NotificationViewItemContentChangeKind[NotificationViewItemContentChangeKind["ACTIONS"] = 2] = "ACTIONS";
    NotificationViewItemContentChangeKind[NotificationViewItemContentChangeKind["PROGRESS"] = 3] = "PROGRESS";
})(NotificationViewItemContentChangeKind || (NotificationViewItemContentChangeKind = {}));
export class NotificationViewItemProgress extends Disposable {
    constructor() {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._state = Object.create(null);
    }
    get state() {
        return this._state;
    }
    infinite() {
        if (this._state.infinite) {
            return;
        }
        this._state.infinite = true;
        this._state.total = undefined;
        this._state.worked = undefined;
        this._state.done = undefined;
        this._onDidChange.fire();
    }
    done() {
        if (this._state.done) {
            return;
        }
        this._state.done = true;
        this._state.infinite = undefined;
        this._state.total = undefined;
        this._state.worked = undefined;
        this._onDidChange.fire();
    }
    total(value) {
        if (this._state.total === value) {
            return;
        }
        this._state.total = value;
        this._state.infinite = undefined;
        this._state.done = undefined;
        this._onDidChange.fire();
    }
    worked(value) {
        if (typeof this._state.worked === 'number') {
            this._state.worked += value;
        }
        else {
            this._state.worked = value;
        }
        this._state.infinite = undefined;
        this._state.done = undefined;
        this._onDidChange.fire();
    }
}
export class NotificationViewItem extends Disposable {
    static { this.MAX_MESSAGE_LENGTH = 1000; }
    static create(notification, filter) {
        if (!notification?.message || isCancellationError(notification.message)) {
            return undefined; // we need a message to show
        }
        let severity;
        if (typeof notification.severity === 'number') {
            severity = notification.severity;
        }
        else {
            severity = Severity.Info;
        }
        const message = NotificationViewItem.parseNotificationMessage(notification.message);
        if (!message) {
            return undefined; // we need a message to show
        }
        let actions;
        if (notification.actions) {
            actions = notification.actions;
        }
        else if (isErrorWithActions(notification.message)) {
            actions = { primary: notification.message.actions };
        }
        let priority = notification.priority ?? NotificationPriority.DEFAULT;
        if ((priority === NotificationPriority.DEFAULT || priority === NotificationPriority.OPTIONAL) && severity !== Severity.Error) {
            if (filter.global === NotificationsFilter.ERROR) {
                priority = NotificationPriority.SILENT; // filtered globally
            }
            else if (isNotificationSource(notification.source) && filter.sources.get(notification.source.id) === NotificationsFilter.ERROR) {
                priority = NotificationPriority.SILENT; // filtered by source
            }
        }
        return new NotificationViewItem(notification.id, severity, notification.sticky, priority, message, notification.source, notification.progress, actions);
    }
    static parseNotificationMessage(input) {
        let message;
        if (input instanceof Error) {
            message = toErrorMessage(input, false);
        }
        else if (typeof input === 'string') {
            message = input;
        }
        if (!message) {
            return undefined; // we need a message to show
        }
        const raw = message;
        // Make sure message is in the limits
        if (message.length > NotificationViewItem.MAX_MESSAGE_LENGTH) {
            message = `${message.substr(0, NotificationViewItem.MAX_MESSAGE_LENGTH)}...`;
        }
        // Remove newlines from messages as we do not support that and it makes link parsing hard
        message = message.replace(/(\r\n|\n|\r)/gm, ' ').trim();
        // Parse Links
        const linkedText = parseLinkedText(message);
        return { raw, linkedText, original: input };
    }
    constructor(id, _severity, _sticky, _priority, _message, _source, progress, actions) {
        super();
        this.id = id;
        this._severity = _severity;
        this._sticky = _sticky;
        this._priority = _priority;
        this._message = _message;
        this._source = _source;
        this._visible = false;
        this._onDidChangeExpansion = this._register(new Emitter());
        this.onDidChangeExpansion = this._onDidChangeExpansion.event;
        this._onDidClose = this._register(new Emitter());
        this.onDidClose = this._onDidClose.event;
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.onDidChangeVisibility = this._onDidChangeVisibility.event;
        if (progress) {
            this.setProgress(progress);
        }
        this.setActions(actions);
    }
    setProgress(progress) {
        if (progress.infinite) {
            this.progress.infinite();
        }
        else if (progress.total) {
            this.progress.total(progress.total);
            if (progress.worked) {
                this.progress.worked(progress.worked);
            }
        }
    }
    setActions(actions = { primary: [], secondary: [] }) {
        this._actions = {
            primary: Array.isArray(actions.primary) ? actions.primary : [],
            secondary: Array.isArray(actions.secondary) ? actions.secondary : []
        };
        this._expanded = actions.primary && actions.primary.length > 0;
    }
    get canCollapse() {
        return !this.hasActions;
    }
    get expanded() {
        return !!this._expanded;
    }
    get severity() {
        return this._severity;
    }
    get sticky() {
        if (this._sticky) {
            return true; // explicitly sticky
        }
        const hasActions = this.hasActions;
        if ((hasActions && this._severity === Severity.Error) || // notification errors with actions are sticky
            (!hasActions && this._expanded) || // notifications that got expanded are sticky
            (this._progress && !this._progress.state.done) // notifications with running progress are sticky
        ) {
            return true;
        }
        return false; // not sticky
    }
    get priority() {
        return this._priority;
    }
    get hasActions() {
        if (!this._actions) {
            return false;
        }
        if (!this._actions.primary) {
            return false;
        }
        return this._actions.primary.length > 0;
    }
    get hasProgress() {
        return !!this._progress;
    }
    get progress() {
        if (!this._progress) {
            this._progress = this._register(new NotificationViewItemProgress());
            this._register(this._progress.onDidChange(() => this._onDidChangeContent.fire({ kind: 3 /* NotificationViewItemContentChangeKind.PROGRESS */ })));
        }
        return this._progress;
    }
    get message() {
        return this._message;
    }
    get source() {
        return typeof this._source === 'string' ? this._source : (this._source ? this._source.label : undefined);
    }
    get sourceId() {
        return (this._source && typeof this._source !== 'string' && 'id' in this._source) ? this._source.id : undefined;
    }
    get actions() {
        return this._actions;
    }
    get visible() {
        return this._visible;
    }
    updateSeverity(severity) {
        if (severity === this._severity) {
            return;
        }
        this._severity = severity;
        this._onDidChangeContent.fire({ kind: 0 /* NotificationViewItemContentChangeKind.SEVERITY */ });
    }
    updateMessage(input) {
        const message = NotificationViewItem.parseNotificationMessage(input);
        if (!message || message.raw === this._message.raw) {
            return;
        }
        this._message = message;
        this._onDidChangeContent.fire({ kind: 1 /* NotificationViewItemContentChangeKind.MESSAGE */ });
    }
    updateActions(actions) {
        this.setActions(actions);
        this._onDidChangeContent.fire({ kind: 2 /* NotificationViewItemContentChangeKind.ACTIONS */ });
    }
    updateVisibility(visible) {
        if (this._visible !== visible) {
            this._visible = visible;
            this._onDidChangeVisibility.fire(visible);
        }
    }
    expand() {
        if (this._expanded || !this.canCollapse) {
            return;
        }
        this._expanded = true;
        this._onDidChangeExpansion.fire();
    }
    collapse(skipEvents) {
        if (!this._expanded || !this.canCollapse) {
            return;
        }
        this._expanded = false;
        if (!skipEvents) {
            this._onDidChangeExpansion.fire();
        }
    }
    toggle() {
        if (this._expanded) {
            this.collapse();
        }
        else {
            this.expand();
        }
    }
    close() {
        this._onDidClose.fire();
        this.dispose();
    }
    equals(other) {
        if (this.hasProgress || other.hasProgress) {
            return false;
        }
        if (typeof this.id === 'string' || typeof other.id === 'string') {
            return this.id === other.id;
        }
        if (typeof this._source === 'object') {
            if (this._source.label !== other.source || this._source.id !== other.sourceId) {
                return false;
            }
        }
        else if (this._source !== other.source) {
            return false;
        }
        if (this._message.raw !== other.message.raw) {
            return false;
        }
        const primaryActions = this._actions?.primary || [];
        const otherPrimaryActions = other.actions?.primary || [];
        return equals(primaryActions, otherPrimaryActions, (action, otherAction) => (action.id + action.label) === (otherAction.id + otherAction.label));
    }
}
export class ChoiceAction extends Action {
    constructor(id, choice) {
        super(id, choice.label, undefined, true, async () => {
            // Pass to runner
            choice.run();
            // Emit Event
            this._onDidRun.fire();
        });
        this._onDidRun = this._register(new Emitter());
        this.onDidRun = this._onDidRun.event;
        this._keepOpen = !!choice.keepOpen;
        this._menu = !choice.isSecondary && choice.menu ? choice.menu.map((c, index) => new ChoiceAction(`${id}.${index}`, c)) : undefined;
    }
    get menu() {
        return this._menu;
    }
    get keepOpen() {
        return this._keepOpen;
    }
}
class StatusMessageViewItem {
    static create(notification, options) {
        if (!notification || isCancellationError(notification)) {
            return undefined; // we need a message to show
        }
        let message;
        if (notification instanceof Error) {
            message = toErrorMessage(notification, false);
        }
        else if (typeof notification === 'string') {
            message = notification;
        }
        if (!message) {
            return undefined; // we need a message to show
        }
        return { message, options };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90aWZpY2F0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29tbW9uL25vdGlmaWNhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFtRixnQkFBZ0IsRUFBRSxRQUFRLEVBQTZELG1CQUFtQixFQUEwRCxvQkFBb0IsRUFBdUIsb0JBQW9CLEVBQWlCLE1BQU0sb0RBQW9ELENBQUM7QUFDelksT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDckQsT0FBTyxFQUFFLGVBQWUsRUFBYyxNQUFNLGlDQUFpQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBNkJ0RSxNQUFNLENBQU4sSUFBa0Isc0JBc0JqQjtBQXRCRCxXQUFrQixzQkFBc0I7SUFFdkM7O09BRUc7SUFDSCxpRUFBRyxDQUFBO0lBRUg7OztPQUdHO0lBQ0gsdUVBQU0sQ0FBQTtJQUVOOztPQUVHO0lBQ0gseUZBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsdUVBQU0sQ0FBQTtBQUNQLENBQUMsRUF0QmlCLHNCQUFzQixLQUF0QixzQkFBc0IsUUFzQnZDO0FBMEJELE1BQU0sQ0FBTixJQUFrQix1QkFHakI7QUFIRCxXQUFrQix1QkFBdUI7SUFDeEMsbUVB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