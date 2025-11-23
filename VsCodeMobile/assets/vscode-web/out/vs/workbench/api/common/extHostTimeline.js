/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { MainContext } from './extHost.protocol.js';
import { toDisposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { ThemeIcon, MarkdownString as MarkdownStringType } from './extHostTypes.js';
import { MarkdownString } from './extHostTypeConverters.js';
import { isString } from '../../../base/common/types.js';
import { isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
export const IExtHostTimeline = createDecorator('IExtHostTimeline');
export class ExtHostTimeline {
    constructor(mainContext, commands) {
        this._providers = new Map();
        this._itemsBySourceAndUriMap = new Map();
        this._proxy = mainContext.getProxy(MainContext.MainThreadTimeline);
        commands.registerArgumentProcessor({
            processArgument: (arg, extension) => {
                if (arg && arg.$mid === 12 /* MarshalledId.TimelineActionContext */) {
                    if (this._providers.get(arg.source) && extension && isProposedApiEnabled(extension, 'timeline')) {
                        const uri = arg.uri === undefined ? undefined : URI.revive(arg.uri);
                        return this._itemsBySourceAndUriMap.get(arg.source)?.get(getUriKey(uri))?.get(arg.handle);
                    }
                    else {
                        return undefined;
                    }
                }
                return arg;
            }
        });
    }
    async $getTimeline(id, uri, options, token) {
        const item = this._providers.get(id);
        return item?.provider.provideTimeline(URI.revive(uri), options, token);
    }
    registerTimelineProvider(scheme, provider, extensionId, commandConverter) {
        const timelineDisposables = new DisposableStore();
        const convertTimelineItem = this.convertTimelineItem(provider.id, commandConverter, timelineDisposables).bind(this);
        let disposable;
        if (provider.onDidChange) {
            disposable = provider.onDidChange(e => this._proxy.$emitTimelineChangeEvent({ uri: undefined, reset: true, ...e, id: provider.id }), this);
        }
        const itemsBySourceAndUriMap = this._itemsBySourceAndUriMap;
        return this.registerTimelineProviderCore({
            ...provider,
            scheme: scheme,
            onDidChange: undefined,
            async provideTimeline(uri, options, token) {
                if (options?.resetCache) {
                    timelineDisposables.clear();
                    // For now, only allow the caching of a single Uri
                    // itemsBySourceAndUriMap.get(provider.id)?.get(getUriKey(uri))?.clear();
                    itemsBySourceAndUriMap.get(provider.id)?.clear();
                }
                const result = await provider.provideTimeline(uri, options, token);
                if (result === undefined || result === null) {
                    return undefined;
                }
                // TODO: Should we bother converting all the data if we aren't caching? Meaning it is being requested by an extension?
                const convertItem = convertTimelineItem(uri, options);
                return {
                    ...result,
                    source: provider.id,
                    items: result.items.map(convertItem)
                };
            },
            dispose() {
                for (const sourceMap of itemsBySourceAndUriMap.values()) {
                    sourceMap.get(provider.id)?.clear();
                }
                disposable?.dispose();
                timelineDisposables.dispose();
            }
        }, extensionId);
    }
    convertTimelineItem(source, commandConverter, disposables) {
        return (uri, options) => {
            let items;
            if (options?.cacheResults) {
                let itemsByUri = this._itemsBySourceAndUriMap.get(source);
                if (itemsByUri === undefined) {
                    itemsByUri = new Map();
                    this._itemsBySourceAndUriMap.set(source, itemsByUri);
                }
                const uriKey = getUriKey(uri);
                items = itemsByUri.get(uriKey);
                if (items === undefined) {
                    items = new Map();
                    itemsByUri.set(uriKey, items);
                }
            }
            return (item) => {
                const { iconPath, ...props } = item;
                const handle = `${source}|${item.id ?? item.timestamp}`;
                items?.set(handle, item);
                let icon;
                let iconDark;
                let themeIcon;
                if (item.iconPath) {
                    if (iconPath instanceof ThemeIcon) {
                        themeIcon = { id: iconPath.id, color: iconPath.color };
                    }
                    else if (URI.isUri(iconPath)) {
                        icon = iconPath;
                        iconDark = iconPath;
                    }
                    else {
                        ({ light: icon, dark: iconDark } = iconPath);
                    }
                }
                let tooltip;
                if (MarkdownStringType.isMarkdownString(props.tooltip)) {
                    tooltip = MarkdownString.from(props.tooltip);
                }
                else if (isString(props.tooltip)) {
                    tooltip = props.tooltip;
                }
                // TODO @jkearl, remove once migration complete.
                // eslint-disable-next-line local/code-no-any-casts
                else if (MarkdownStringType.isMarkdownString(props.detail)) {
                    console.warn('Using deprecated TimelineItem.detail, migrate to TimelineItem.tooltip');
                    // eslint-disable-next-line local/code-no-any-casts
                    tooltip = MarkdownString.from(props.detail);
                }
                // eslint-disable-next-line local/code-no-any-casts
                else if (isString(props.detail)) {
                    console.warn('Using deprecated TimelineItem.detail, migrate to TimelineItem.tooltip');
                    // eslint-disable-next-line local/code-no-any-casts
                    tooltip = props.detail;
                }
                return {
                    ...props,
                    id: props.id ?? undefined,
                    handle: handle,
                    source: source,
                    command: item.command ? commandConverter.toInternal(item.command, disposables) : undefined,
                    icon: icon,
                    iconDark: iconDark,
                    themeIcon: themeIcon,
                    tooltip,
                    accessibilityInformation: item.accessibilityInformation
                };
            };
        };
    }
    registerTimelineProviderCore(provider, extension) {
        // console.log(`ExtHostTimeline#registerTimelineProvider: id=${provider.id}`);
        const existing = this._providers.get(provider.id);
        if (existing) {
            throw new Error(`Timeline Provider ${provider.id} already exists.`);
        }
        this._proxy.$registerTimelineProvider({
            id: provider.id,
            label: provider.label,
            scheme: provider.scheme
        });
        this._providers.set(provider.id, { provider, extension });
        return toDisposable(() => {
            for (const sourceMap of this._itemsBySourceAndUriMap.values()) {
                sourceMap.get(provider.id)?.clear();
            }
            this._providers.delete(provider.id);
            this._proxy.$unregisterTimelineProvider(provider.id);
            provider.dispose();
        });
    }
}
function getUriKey(uri) {
    return uri?.toString();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFRpbWVsaW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RUaW1lbGluZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQWlCLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQStELFdBQVcsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRWpILE9BQU8sRUFBZSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHL0YsT0FBTyxFQUFFLFNBQVMsRUFBRSxjQUFjLElBQUksa0JBQWtCLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFHNUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBT3RGLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBbUIsa0JBQWtCLENBQUMsQ0FBQztBQUV0RixNQUFNLE9BQU8sZUFBZTtJQVMzQixZQUNDLFdBQXlCLEVBQ3pCLFFBQXlCO1FBTmxCLGVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBMEUsQ0FBQztRQUUvRiw0QkFBdUIsR0FBRyxJQUFJLEdBQUcsRUFBcUUsQ0FBQztRQU05RyxJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFbkUsUUFBUSxDQUFDLHlCQUF5QixDQUFDO1lBQ2xDLGVBQWUsRUFBRSxDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRTtnQkFD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