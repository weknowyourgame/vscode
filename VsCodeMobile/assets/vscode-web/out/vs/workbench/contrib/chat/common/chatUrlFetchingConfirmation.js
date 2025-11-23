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
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { ChatConfiguration } from './constants.js';
import { extractUrlPatterns, getPatternLabel, isUrlApproved } from './chatUrlFetchingPatterns.js';
const trashButton = {
    iconClass: ThemeIcon.asClassName(Codicon.trash),
    tooltip: localize('delete', "Delete")
};
let ChatUrlFetchingConfirmationContribution = class ChatUrlFetchingConfirmationContribution {
    constructor(_getURLS, _configurationService, _quickInputService, _preferencesService) {
        this._getURLS = _getURLS;
        this._configurationService = _configurationService;
        this._quickInputService = _quickInputService;
        this._preferencesService = _preferencesService;
        this.canUseDefaultApprovals = false;
    }
    getPreConfirmAction(ref) {
        return this._checkApproval(ref, true);
    }
    getPostConfirmAction(ref) {
        return this._checkApproval(ref, false);
    }
    _checkApproval(ref, checkRequest) {
        const urls = this._getURLS(ref.parameters);
        if (!urls || urls.length === 0) {
            return undefined;
        }
        const approvedUrls = this._getApprovedUrls();
        // Check if all URLs are approved
        const allApproved = urls.every(url => {
            try {
                const uri = URI.parse(url);
                return isUrlApproved(uri, approvedUrls, checkRequest);
            }
            catch {
                return false;
            }
        });
        if (allApproved) {
            return {
                type: 2 /* ToolConfirmKind.Setting */,
                id: ChatConfiguration.AutoApprovedUrls
            };
        }
        return undefined;
    }
    getPreConfirmActions(ref) {
        return this._getConfirmActions(ref, true);
    }
    getPostConfirmActions(ref) {
        return this._getConfirmActions(ref, false);
    }
    _getConfirmActions(ref, forRequest) {
        const urls = this._getURLS(ref.parameters);
        if (!urls || urls.length === 0) {
            return [];
        }
        const actions = [];
        // Get unique URLs (may have duplicates)
        const uniqueUrls = Array.from(new Set(urls)).map(u => URI.parse(u));
        // For each URL, get its patterns
        const urlPatterns = new ResourceMap(uniqueUrls.map(u => [u, extractUrlPatterns(u)]));
        // If only one URL, show quick actions for specific patterns
        if (urlPatterns.size === 1) {
            const uri = uniqueUrls[0];
            const patterns = urlPatterns.get(uri);
            // Show top 2 most relevant patterns as quick actions
            const topPatterns = patterns.slice(0, 2);
            for (const pattern of topPatterns) {
                const patternLabel = getPatternLabel(uri, pattern);
                actions.push({
                    label: forRequest
                        ? localize('approveRequestTo', "Allow requests to {0}", patternLabel)
                        : localize('approveResponseFrom', "Allow responses from {0}", patternLabel),
                    select: async () => {
                        await this._approvePattern(pattern, forRequest, !forRequest);
                        return true;
                    }
                });
            }
            // "More options" action
            actions.push({
                label: localize('moreOptions', "Allow requests to..."),
                select: async () => {
                    const result = await this._showMoreOptions(ref, [{ uri, patterns }], forRequest);
                    return result;
                }
            });
        }
        else {
            // Multiple URLs - show "More options" only
            actions.push({
                label: localize('moreOptionsMultiple', "Configure URL Approvals..."),
                select: async () => {
                    await this._showMoreOptions(ref, [...urlPatterns].map(([uri, patterns]) => ({ uri, patterns })), forRequest);
                    return true;
                }
            });
        }
        return actions;
    }
    async _showMoreOptions(ref, urls, forRequest) {
        return new Promise((resolve) => {
            const disposables = new DisposableStore();
            const quickTree = disposables.add(this._quickInputService.createQuickTree());
            quickTree.ignoreFocusOut = true;
            quickTree.sortByLabel = false;
            quickTree.placeholder = localize('selectApproval', "Select URL pattern to approve");
            const treeItems = [];
            const approvedUrls = this._getApprovedUrls();
            for (const { uri, patterns } of urls) {
                for (const pattern of patterns.slice().sort((a, b) => b.length - a.length)) {
                    const settings = approvedUrls[pattern];
                    const requestChecked = typeof settings === 'boolean' ? settings : (settings?.approveRequest ?? false);
                    const responseChecked = typeof settings === 'boolean' ? settings : (settings?.approveResponse ?? false);
                    treeItems.push({
                        label: getPatternLabel(uri, pattern),
                        pattern,
                        checked: requestChecked && responseChecked ? true : (!requestChecked && !responseChecked ? false : 'mixed'),
                        collapsed: true,
                        children: [
                            {
                                label: localize('allowRequestsCheckbox', "Make requests without confirmation"),
                                pattern,
                                approvalType: 'request',
                                checked: requestChecked
                            },
                            {
                                label: localize('allowResponsesCheckbox', "Allow responses without confirmation"),
                                pattern,
                                approvalType: 'response',
                                checked: responseChecked
                            }
                        ],
                    });
                }
            }
            quickTree.setItemTree(treeItems);
            const updateApprovals = () => {
                const current = { ...this._getApprovedUrls() };
                for (const item of quickTree.itemTree) {
                    // root-level items
                    const allowPre = item.children?.find(c => c.approvalType === 'request')?.checked;
                    const allowPost = item.children?.find(c => c.approvalType === 'response')?.checked;
                    if (allowPost && allowPre) {
                        current[item.pattern] = true;
                    }
                    else if (!allowPost && !allowPre) {
                        delete current[item.pattern];
                    }
                    else {
                        current[item.pattern] = {
                            approveRequest: !!allowPre || undefined,
                            approveResponse: !!allowPost || undefined,
                        };
                    }
                }
                return this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, current);
            };
            disposables.add(quickTree.onDidAccept(async () => {
                quickTree.busy = true;
                await updateApprovals();
                resolve(!!this._checkApproval(ref, forRequest));
                quickTree.hide();
            }));
            disposables.add(quickTree.onDidHide(() => {
                updateApprovals();
                disposables.dispose();
                resolve(false);
            }));
            quickTree.show();
        });
    }
    async _approvePattern(pattern, approveRequest, approveResponse) {
        const approvedUrls = { ...this._getApprovedUrls() };
        // Create the approval settings
        let value;
        if (approveRequest === approveResponse) {
            value = approveRequest;
        }
        else {
            value = { approveRequest, approveResponse };
        }
        approvedUrls[pattern] = value;
        await this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, approvedUrls);
    }
    getManageActions() {
        const approvedUrls = { ...this._getApprovedUrls() };
        const items = [];
        for (const [pattern, settings] of Object.entries(approvedUrls)) {
            const label = pattern;
            let description;
            if (typeof settings === 'boolean') {
                description = settings
                    ? localize('approveAll', "Approve all")
                    : localize('denyAll', "Deny all");
            }
            else {
                const parts = [];
                if (settings.approveRequest) {
                    parts.push(localize('requests', "requests"));
                }
                if (settings.approveResponse) {
                    parts.push(localize('responses', "responses"));
                }
                description = parts.length > 0
                    ? localize('approves', "Approves {0}", parts.join(', '))
                    : localize('noApprovals', "No approvals");
            }
            const item = {
                label,
                description,
                buttons: [trashButton],
                checked: true,
                onDidChangeChecked: (checked) => {
                    if (checked) {
                        approvedUrls[pattern] = settings;
                    }
                    else {
                        delete approvedUrls[pattern];
                    }
                    this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, approvedUrls);
                }
            };
            items.push(item);
        }
        items.push({
            pickable: false,
            label: localize('moreOptionsManage', "More Options..."),
            description: localize('openSettings', "Open settings"),
            onDidOpen: () => {
                this._preferencesService.openUserSettings({ query: ChatConfiguration.AutoApprovedUrls });
            }
        });
        return items;
    }
    async reset() {
        await this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, {});
    }
    _getApprovedUrls() {
        return this._configurationService.getValue(ChatConfiguration.AutoApprovedUrls) || {};
    }
};
ChatUrlFetchingConfirmationContribution = __decorate([
    __param(1, IConfigurationService),
    __param(2, IQuickInputService),
    __param(3, IPreferencesService)
], ChatUrlFetchingConfirmationContribution);
export { ChatUrlFetchingConfirmationContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFVybEZldGNoaW5nQ29uZmlybWF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRVcmxGZXRjaGluZ0NvbmZpcm1hdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQXFCLGtCQUFrQixFQUFrQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBT25ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUF3QixNQUFNLDhCQUE4QixDQUFDO0FBRXhILE1BQU0sV0FBVyxHQUFzQjtJQUN0QyxTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQy9DLE9BQU8sRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztDQUNyQyxDQUFDO0FBRUssSUFBTSx1Q0FBdUMsR0FBN0MsTUFBTSx1Q0FBdUM7SUFHbkQsWUFDa0IsUUFBdUQsRUFDakQscUJBQTZELEVBQ2hFLGtCQUF1RCxFQUN0RCxtQkFBeUQ7UUFIN0QsYUFBUSxHQUFSLFFBQVEsQ0FBK0M7UUFDaEMsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUMvQyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW9CO1FBQ3JDLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBcUI7UUFOdEUsMkJBQXNCLEdBQUcsS0FBSyxDQUFDO0lBT3BDLENBQUM7SUFFTCxtQkFBbUIsQ0FBQyxHQUFzQztRQUN6RCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxHQUFzQztRQUMxRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFTyxjQUFjLENBQUMsR0FBc0MsRUFBRSxZQUFxQjtRQUNuRixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDaEMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRTdDLGlDQUFpQztRQUNqQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ3BDLElBQUksQ0FBQztnQkFDSixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMzQixPQUFPLGFBQWEsQ0FBQyxHQUFHLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1IsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE9BQU87Z0JBQ04sSUFBSSxpQ0FBeUI7Z0JBQzdCLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxnQkFBZ0I7YUFDdEMsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsb0JBQW9CLENBQUMsR0FBc0M7UUFDMUQsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxHQUFzQztRQUMzRCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVPLGtCQUFrQixDQUFDLEdBQXNDLEVBQUUsVUFBbUI7UUFDckYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUE0QyxFQUFFLENBQUM7UUFFNUQsd0NBQXdDO1FBQ3hDLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFcEUsaUNBQWlDO1FBQ2pDLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxDQUFXLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBVSxDQUFDLENBQUMsQ0FBQztRQUV4Ryw0REFBNEQ7UUFDNUQsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzVCLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO1lBRXZDLHFEQUFxRDtZQUNyRCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN6QyxLQUFLLE1BQU0sT0FBTyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNuQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNaLEtBQUssRUFBRSxVQUFVO3dCQUNoQixDQUFDLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLHVCQUF1QixFQUFFLFlBQVksQ0FBQzt3QkFDckUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwwQkFBMEIsRUFBRSxZQUFZLENBQUM7b0JBQzVFLE1BQU0sRUFBRSxLQUFLLElBQUksRUFBRTt3QkFDbEIsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQzt3QkFDN0QsT0FBTyxJQUFJLENBQUM7b0JBQ2IsQ0FBQztpQkFDRCxDQUFDLENBQUM7WUFDSixDQUFDO1lBRUQsd0JBQXdCO1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ1osS0FBSyxFQUFFLFFBQVEsQ0FBQyxhQUFhLEVBQUUsc0JBQXNCLENBQUM7Z0JBQ3RELE1BQU0sRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDbEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDakYsT0FBTyxNQUFNLENBQUM7Z0JBQ2YsQ0FBQzthQUNELENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsMkNBQTJDO1lBQzNDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ1osS0FBSyxFQUFFLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSw0QkFBNEIsQ0FBQztnQkFDcEUsTUFBTSxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUNsQixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDN0csT0FBTyxJQUFJLENBQUM7Z0JBQ2IsQ0FBQzthQUNELENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNoQixDQUFDO0lBRU8sS0FBSyxDQUFDLGdCQUFnQixDQUFDLEdBQXNDLEVBQUUsSUFBd0MsRUFBRSxVQUFtQjtRQU9uSSxPQUFPLElBQUksT0FBTyxDQUFVLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUMxQyxNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQW9CLENBQUMsQ0FBQztZQUMvRixTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztZQUNoQyxTQUFTLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUM5QixTQUFTLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSwrQkFBK0IsQ0FBQyxDQUFDO1lBRXBGLE1BQU0sU0FBUyxHQUF1QixFQUFFLENBQUM7WUFDekMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFFN0MsS0FBSyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUN0QyxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUM1RSxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sY0FBYyxHQUFHLE9BQU8sUUFBUSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxjQUFjLElBQUksS0FBSyxDQUFDLENBQUM7b0JBQ3RHLE1BQU0sZUFBZSxHQUFHLE9BQU8sUUFBUSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxlQUFlLElBQUksS0FBSyxDQUFDLENBQUM7b0JBRXhHLFNBQVMsQ0FBQyxJQUFJLENBQUM7d0JBQ2QsS0FBSyxFQUFFLGVBQWUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDO3dCQUNwQyxPQUFPO3dCQUNQLE9BQU8sRUFBRSxjQUFjLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO3dCQUMzRyxTQUFTLEVBQUUsSUFBSTt3QkFDZixRQUFRLEVBQUU7NEJBQ1Q7Z0NBQ0MsS0FBSyxFQUFFLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxvQ0FBb0MsQ0FBQztnQ0FDOUUsT0FBTztnQ0FDUCxZQUFZLEVBQUUsU0FBUztnQ0FDdkIsT0FBTyxFQUFFLGNBQWM7NkJBQ3ZCOzRCQUNEO2dDQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsd0JBQXdCLEVBQUUsc0NBQXNDLENBQUM7Z0NBQ2pGLE9BQU87Z0NBQ1AsWUFBWSxFQUFFLFVBQVU7Z0NBQ3hCLE9BQU8sRUFBRSxlQUFlOzZCQUN4Qjt5QkFDRDtxQkFDRCxDQUFDLENBQUM7Z0JBQ0osQ0FBQztZQUNGLENBQUM7WUFFRCxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRWpDLE1BQU0sZUFBZSxHQUFHLEdBQUcsRUFBRTtnQkFDNUIsTUFBTSxPQUFPLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUM7Z0JBQy9DLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUN2QyxtQkFBbUI7b0JBRW5CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksS0FBSyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUM7b0JBQ2pGLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksS0FBSyxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUM7b0JBRW5GLElBQUksU0FBUyxJQUFJLFFBQVEsRUFBRSxDQUFDO3dCQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQztvQkFDOUIsQ0FBQzt5QkFBTSxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQ3BDLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDOUIsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUc7NEJBQ3ZCLGNBQWMsRUFBRSxDQUFDLENBQUMsUUFBUSxJQUFJLFNBQVM7NEJBQ3ZDLGVBQWUsRUFBRSxDQUFDLENBQUMsU0FBUyxJQUFJLFNBQVM7eUJBQ3pDLENBQUM7b0JBQ0gsQ0FBQztnQkFDRixDQUFDO2dCQUVELE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM1RixDQUFDLENBQUM7WUFFRixXQUFXLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLEVBQUU7Z0JBQ2hELFNBQVMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO2dCQUN0QixNQUFNLGVBQWUsRUFBRSxDQUFDO2dCQUN4QixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosV0FBVyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtnQkFDeEMsZUFBZSxFQUFFLENBQUM7Z0JBQ2xCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDdEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFSixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxPQUFlLEVBQUUsY0FBdUIsRUFBRSxlQUF3QjtRQUMvRixNQUFNLFlBQVksR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsQ0FBQztRQUVwRCwrQkFBK0I7UUFDL0IsSUFBSSxLQUFxQyxDQUFDO1FBQzFDLElBQUksY0FBYyxLQUFLLGVBQWUsRUFBRSxDQUFDO1lBQ3hDLEtBQUssR0FBRyxjQUFjLENBQUM7UUFDeEIsQ0FBQzthQUFNLENBQUM7WUFDUCxLQUFLLEdBQUcsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLENBQUM7UUFDN0MsQ0FBQztRQUVELFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxLQUFLLENBQUM7UUFFOUIsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUMzQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFDbEMsWUFBWSxDQUNaLENBQUM7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCO1FBQ2YsTUFBTSxZQUFZLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUM7UUFDcEQsTUFBTSxLQUFLLEdBQThELEVBQUUsQ0FBQztRQUU1RSxLQUFLLE1BQU0sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ2hFLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQztZQUN0QixJQUFJLFdBQW1CLENBQUM7WUFFeEIsSUFBSSxPQUFPLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDbkMsV0FBVyxHQUFHLFFBQVE7b0JBQ3JCLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQztvQkFDdkMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDcEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzdCLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDO2dCQUNELElBQUksUUFBUSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUM5QixLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDaEQsQ0FBQztnQkFDRCxXQUFXLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUM3QixDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDeEQsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDNUMsQ0FBQztZQUVELE1BQU0sSUFBSSxHQUE0RDtnQkFDckUsS0FBSztnQkFDTCxXQUFXO2dCQUNYLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQztnQkFDdEIsT0FBTyxFQUFFLElBQUk7Z0JBQ2Isa0JBQWtCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtvQkFDL0IsSUFBSSxPQUFPLEVBQUUsQ0FBQzt3QkFDYixZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsUUFBUSxDQUFDO29CQUNsQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQzlCLENBQUM7b0JBRUQsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDMUYsQ0FBQzthQUNELENBQUM7WUFFRixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ1YsUUFBUSxFQUFFLEtBQUs7WUFDZixLQUFLLEVBQUUsUUFBUSxDQUFDLG1CQUFtQixFQUFFLGlCQUFpQixDQUFDO1lBQ3ZELFdBQVcsRUFBRSxRQUFRLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQztZQUN0RCxTQUFTLEVBQUUsR0FBRyxFQUFFO2dCQUNmLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFDMUYsQ0FBQztTQUNELENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1YsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUMzQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFDbEMsRUFBRSxDQUNGLENBQUM7SUFDSCxDQUFDO0lBRU8sZ0JBQWdCO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FDekMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQ2xDLElBQUksRUFBRSxDQUFDO0lBQ1QsQ0FBQztDQUNELENBQUE7QUE3UlksdUNBQXVDO0lBS2pELFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLG1CQUFtQixDQUFBO0dBUFQsdUNBQXVDLENBNlJuRCJ9