/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SCMHistoryItemContext_1, SCMHistoryItemChangeRangeContentProvider_1;
import { coalesce } from '../../../../base/common/arrays.js';
import { ThrottledDelayer } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { fromNow } from '../../../../base/common/date.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CodeDataTransfers } from '../../../../platform/dnd/browser/dnd.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { IChatContextPickService, picksWithPromiseFn } from '../../chat/browser/chatContextPickService.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { ScmHistoryItemResolver } from '../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js';
import { ISCMService, ISCMViewService } from '../common/scm.js';
export function extractSCMHistoryItemDropData(e) {
    if (!e.dataTransfer?.types.includes(CodeDataTransfers.SCM_HISTORY_ITEM)) {
        return undefined;
    }
    const data = e.dataTransfer?.getData(CodeDataTransfers.SCM_HISTORY_ITEM);
    if (!data) {
        return undefined;
    }
    return JSON.parse(data);
}
let SCMHistoryItemContextContribution = class SCMHistoryItemContextContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chat.scmHistoryItemContextContribution'; }
    constructor(contextPickService, instantiationService, textModelResolverService) {
        super();
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(SCMHistoryItemContext)));
        this._store.add(textModelResolverService.registerTextModelContentProvider(ScmHistoryItemResolver.scheme, instantiationService.createInstance(SCMHistoryItemContextContentProvider)));
        this._store.add(textModelResolverService.registerTextModelContentProvider(SCMHistoryItemChangeRangeContentProvider.scheme, instantiationService.createInstance(SCMHistoryItemChangeRangeContentProvider)));
    }
};
SCMHistoryItemContextContribution = __decorate([
    __param(0, IChatContextPickService),
    __param(1, IInstantiationService),
    __param(2, ITextModelService)
], SCMHistoryItemContextContribution);
export { SCMHistoryItemContextContribution };
let SCMHistoryItemContext = SCMHistoryItemContext_1 = class SCMHistoryItemContext {
    static asAttachment(provider, historyItem) {
        const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
        const multiDiffSourceUri = ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem.id, historyItemParentId, historyItem.displayId);
        const attachmentName = `$(${Codicon.repo.id})\u00A0${provider.name}\u00A0$(${Codicon.gitCommit.id})\u00A0${historyItem.displayId ?? historyItem.id}`;
        return {
            id: historyItem.id,
            name: attachmentName,
            value: multiDiffSourceUri,
            historyItem: {
                ...historyItem,
                references: []
            },
            kind: 'scmHistoryItem'
        };
    }
    constructor(_scmViewService) {
        this._scmViewService = _scmViewService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.scmHistoryItems', 'Source Control...');
        this.icon = Codicon.gitCommit;
        this._delayer = new ThrottledDelayer(200);
    }
    isEnabled(widget) {
        const activeRepository = this._scmViewService.activeRepository.get();
        const supported = !!widget.attachmentCapabilities.supportsSourceControlAttachments;
        return activeRepository?.repository.provider.historyProvider.get() !== undefined && supported;
    }
    asPicker(_widget) {
        return {
            placeholder: localize('chatContext.scmHistoryItems.placeholder', 'Select a change'),
            picks: picksWithPromiseFn((query, token) => {
                const filterText = query.trim() !== '' ? query.trim() : undefined;
                const activeRepository = this._scmViewService.activeRepository.get();
                const historyProvider = activeRepository?.repository.provider.historyProvider.get();
                if (!activeRepository || !historyProvider) {
                    return Promise.resolve([]);
                }
                const historyItemRefs = coalesce([
                    historyProvider.historyItemRef.get(),
                    historyProvider.historyItemRemoteRef.get(),
                    historyProvider.historyItemBaseRef.get(),
                ]).map(ref => ref.id);
                return this._delayer.trigger(() => {
                    return historyProvider.provideHistoryItems({ historyItemRefs, filterText, limit: 100 }, token)
                        .then(historyItems => {
                        if (!historyItems) {
                            return [];
                        }
                        return historyItems.map(historyItem => {
                            const details = [`${historyItem.displayId ?? historyItem.id}`];
                            if (historyItem.author) {
                                details.push(historyItem.author);
                            }
                            if (historyItem.statistics) {
                                details.push(`${historyItem.statistics.files} ${localize('files', 'file(s)')}`);
                            }
                            if (historyItem.timestamp) {
                                details.push(fromNow(historyItem.timestamp, true, true));
                            }
                            return {
                                iconClass: ThemeIcon.asClassName(Codicon.gitCommit),
                                label: historyItem.subject,
                                detail: details.join(`$(${Codicon.circleSmallFilled.id})`),
                                asAttachment: () => SCMHistoryItemContext_1.asAttachment(activeRepository.repository.provider, historyItem)
                            };
                        });
                    });
                });
            })
        };
    }
};
SCMHistoryItemContext = SCMHistoryItemContext_1 = __decorate([
    __param(0, ISCMViewService)
], SCMHistoryItemContext);
let SCMHistoryItemContextContentProvider = class SCMHistoryItemContextContentProvider {
    constructor(_modelService, _scmService) {
        this._modelService = _modelService;
        this._scmService = _scmService;
    }
    async provideTextContent(resource) {
        const uriFields = ScmHistoryItemResolver.parseUri(resource);
        if (!uriFields) {
            return null;
        }
        const textModel = this._modelService.getModel(resource);
        if (textModel) {
            return textModel;
        }
        const { repositoryId, historyItemId } = uriFields;
        const repository = this._scmService.getRepository(repositoryId);
        const historyProvider = repository?.provider.historyProvider.get();
        if (!repository || !historyProvider) {
            return null;
        }
        const historyItemContext = await historyProvider.resolveHistoryItemChatContext(historyItemId);
        if (!historyItemContext) {
            return null;
        }
        return this._modelService.createModel(historyItemContext, null, resource, false);
    }
};
SCMHistoryItemContextContentProvider = __decorate([
    __param(0, IModelService),
    __param(1, ISCMService)
], SCMHistoryItemContextContentProvider);
let SCMHistoryItemChangeRangeContentProvider = class SCMHistoryItemChangeRangeContentProvider {
    static { SCMHistoryItemChangeRangeContentProvider_1 = this; }
    static { this.scheme = 'scm-history-item-change-range'; }
    constructor(_modelService, _scmService) {
        this._modelService = _modelService;
        this._scmService = _scmService;
    }
    async provideTextContent(resource) {
        const uriFields = this._parseUri(resource);
        if (!uriFields) {
            return null;
        }
        const textModel = this._modelService.getModel(resource);
        if (textModel) {
            return textModel;
        }
        const { repositoryId, start, end } = uriFields;
        const repository = this._scmService.getRepository(repositoryId);
        const historyProvider = repository?.provider.historyProvider.get();
        if (!repository || !historyProvider) {
            return null;
        }
        const historyItemChangeRangeContext = await historyProvider.resolveHistoryItemChangeRangeChatContext(end, start, resource.path);
        if (!historyItemChangeRangeContext) {
            return null;
        }
        return this._modelService.createModel(historyItemChangeRangeContext, null, resource, false);
    }
    _parseUri(uri) {
        if (uri.scheme !== SCMHistoryItemChangeRangeContentProvider_1.scheme) {
            return undefined;
        }
        let query;
        try {
            query = JSON.parse(uri.query);
        }
        catch (e) {
            return undefined;
        }
        if (typeof query !== 'object' || query === null) {
            return undefined;
        }
        const { repositoryId, start, end } = query;
        if (typeof repositoryId !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
            return undefined;
        }
        return { repositoryId, start, end };
    }
};
SCMHistoryItemChangeRangeContentProvider = SCMHistoryItemChangeRangeContentProvider_1 = __decorate([
    __param(0, IModelService),
    __param(1, ISCMService)
], SCMHistoryItemChangeRangeContentProvider);
export { SCMHistoryItemChangeRangeContentProvider };
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.addHistoryItemToChat',
            title: localize('chat.action.scmHistoryItemContext', 'Add to Chat'),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryItemContext,
                group: 'z_chat',
                order: 1,
                when: ChatContextKeys.enabled
            }
        });
    }
    async run(accessor, provider, historyItem) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = await chatWidgetService.revealWidget();
        if (!provider || !historyItem || !widget) {
            return;
        }
        widget.attachmentModel.addContext(SCMHistoryItemContext.asAttachment(provider, historyItem));
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.summarizeHistoryItem',
            title: localize('chat.action.scmHistoryItemSummarize', 'Explain Changes'),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryItemContext,
                group: 'z_chat',
                order: 2,
                when: ChatContextKeys.enabled
            }
        });
    }
    async run(accessor, provider, historyItem) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = await chatWidgetService.revealWidget();
        if (!provider || !historyItem || !widget) {
            return;
        }
        widget.attachmentModel.addContext(SCMHistoryItemContext.asAttachment(provider, historyItem));
        await widget.acceptInput('Summarize the attached history item');
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.addHistoryItemChangeToChat',
            title: localize('chat.action.scmHistoryItemContext', 'Add to Chat'),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryItemChangeContext,
                group: 'z_chat',
                order: 1,
                when: ChatContextKeys.enabled
            }
        });
    }
    async run(accessor, historyItem, historyItemChange) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = await chatWidgetService.revealWidget();
        if (!historyItem || !historyItemChange.modifiedUri || !widget) {
            return;
        }
        widget.attachmentModel.addContext({
            id: historyItemChange.uri.toString(),
            name: `${basename(historyItemChange.modifiedUri)}`,
            value: historyItemChange.modifiedUri,
            historyItem: historyItem,
            kind: 'scmHistoryItemChange',
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtSGlzdG9yeUNoYXRDb250ZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9icm93c2VyL3NjbUhpc3RvcnlDaGF0Q29udGV4dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXBFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHakUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBNkIsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNySCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBRXJILE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzdFLE9BQU8sRUFBc0QsdUJBQXVCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMs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