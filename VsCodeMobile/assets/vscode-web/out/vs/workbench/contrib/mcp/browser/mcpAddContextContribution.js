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
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatContextPickService } from '../../chat/browser/chatContextPickService.js';
import { IMcpService } from '../common/mcpTypes.js';
import { McpResourcePickHelper } from './mcpResourceQuickAccess.js';
let McpAddContextContribution = class McpAddContextContribution extends Disposable {
    constructor(_chatContextPickService, _instantiationService, mcpService) {
        super();
        this._chatContextPickService = _chatContextPickService;
        this._instantiationService = _instantiationService;
        this._addContextMenu = this._register(new MutableDisposable());
        const hasServersWithResources = derived(reader => {
            let enabled = false;
            for (const server of mcpService.servers.read(reader)) {
                const cap = server.capabilities.read(undefined);
                if (cap === undefined) {
                    enabled = true; // until we know more
                }
                else if (cap & 16 /* McpCapability.Resources */) {
                    enabled = true;
                    break;
                }
            }
            return enabled;
        });
        this._register(autorun(reader => {
            const enabled = hasServersWithResources.read(reader);
            if (enabled && !this._addContextMenu.value) {
                this._registerAddContextMenu();
            }
            else {
                this._addContextMenu.clear();
            }
        }));
    }
    _registerAddContextMenu() {
        this._addContextMenu.value = this._chatContextPickService.registerChatContextItem({
            type: 'pickerPick',
            label: localize('mcp.addContext', "MCP Resources..."),
            icon: Codicon.mcp,
            isEnabled(widget) {
                return !!widget.attachmentCapabilities.supportsMCPAttachments;
            },
            asPicker: () => {
                const helper = this._instantiationService.createInstance(McpResourcePickHelper);
                return {
                    placeholder: localize('mcp.addContext.placeholder', "Select MCP Resource..."),
                    picks: (_query, token) => this._getResourcePicks(token, helper),
                    goBack: () => {
                        return helper.navigateBack();
                    },
                    dispose: () => {
                        helper.dispose();
                    }
                };
            },
        });
    }
    _getResourcePicks(token, helper) {
        const picksObservable = helper.getPicks(token);
        return derived(this, reader => {
            const pickItems = picksObservable.read(reader);
            const picks = [];
            for (const [server, resources] of pickItems.picks) {
                if (resources.length === 0) {
                    continue;
                }
                picks.push(McpResourcePickHelper.sep(server));
                for (const resource of resources) {
                    picks.push({
                        ...McpResourcePickHelper.item(resource),
                        asAttachment: () => helper.toAttachment(resource, server)
                    });
                }
            }
            return { picks, busy: pickItems.isBusy };
        });
    }
};
McpAddContextContribution = __decorate([
    __param(0, IChatContextPickService),
    __param(1, IInstantiationService),
    __param(2, IMcpService)
], McpAddContextContribution);
export { McpAddContextContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwQWRkQ29udGV4dENvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BBZGRDb250ZXh0Q29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDckYsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFbkcsT0FBTyxFQUFtQix1QkFBdUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxXQUFXLEVBQWlCLE1BQU0sdUJBQXVCLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFN0QsSUFBTSx5QkFBeUIsR0FBL0IsTUFBTSx5QkFBMEIsU0FBUSxVQUFVO0lBRXhELFlBQzBCLHVCQUFpRSxFQUNuRSxxQkFBNkQsRUFDdkUsVUFBdUI7UUFFcEMsS0FBSyxFQUFFLENBQUM7UUFKa0MsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUF5QjtRQUNsRCwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBSHBFLG9CQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQVExRSxNQUFNLHVCQUF1QixHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNoRCxJQUFJLE9BQU8sR0FB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