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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { IRemoteCodingAgentsService } from '../common/remoteCodingAgentsService.js';
const extensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'remoteCodingAgents',
    jsonSchema: {
        description: localize('remoteCodingAgentsExtPoint', 'Contributes remote coding agent integrations to the chat widget.'),
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: {
                    description: localize('remoteCodingAgentsExtPoint.id', 'A unique identifier for this item.'),
                    type: 'string',
                },
                command: {
                    description: localize('remoteCodingAgentsExtPoint.command', 'Identifier of the command to execute. The command must be declared in the "commands" section.'),
                    type: 'string'
                },
                displayName: {
                    description: localize('remoteCodingAgentsExtPoint.displayName', 'A user-friendly name for this item which is used for display in menus.'),
                    type: 'string'
                },
                description: {
                    description: localize('remoteCodingAgentsExtPoint.description', 'Description of the remote agent for use in menus and tooltips.'),
                    type: 'string'
                },
                followUpRegex: {
                    description: localize('remoteCodingAgentsExtPoint.followUpRegex', 'The last occurrence of pattern in an existing chat conversation is sent to the contributing extension to facilitate follow-up responses.'),
                    type: 'string',
                },
                when: {
                    description: localize('remoteCodingAgentsExtPoint.when', 'Condition which must be true to show this item.'),
                    type: 'string'
                },
            },
            required: ['command', 'displayName'],
        }
    }
});
let RemoteCodingAgentsContribution = class RemoteCodingAgentsContribution extends Disposable {
    constructor(remoteCodingAgentsService) {
        super();
        this.remoteCodingAgentsService = remoteCodingAgentsService;
        extensionPoint.setHandler(extensions => {
            for (const ext of extensions) {
                if (!isProposedApiEnabled(ext.description, 'remoteCodingAgents')) {
                    continue;
                }
                if (!Array.isArray(ext.value)) {
                    continue;
                }
                for (const contribution of ext.value) {
                    const command = MenuRegistry.getCommand(contribution.command);
                    if (!command) {
                        continue;
                    }
                    const agent = {
                        id: contribution.id,
                        command: contribution.command,
                        displayName: contribution.displayName,
                        description: contribution.description,
                        followUpRegex: contribution.followUpRegex,
                        when: contribution.when
                    };
                    this.remoteCodingAgentsService.registerAgent(agent);
                }
            }
        });
    }
};
RemoteCodingAgentsContribution = __decorate([
    __param(0, IRemoteCodingAgentsService)
], RemoteCodingAgentsContribution);
export { RemoteCodingAgentsContribution };
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteCodingAgentsContribution, 3 /* LifecyclePhase.Restored */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlQ29kaW5nQWdlbnRzLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGVDb2RpbmdBZ2VudHMvYnJvd3Nlci9yZW1vdGVDb2RpbmdBZ2VudHMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRTlFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQTBCLFVBQVUsSUFBSSxtQkFBbUIsRUFBbUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUM5SSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUUvRixPQUFPLEVBQXNCLDBCQUEwQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFXeEcsTUFBTSxjQUFjLEdBQUcsa0JBQWtCLENBQUMsc0JBQXNCLENBQXFDO0lBQ3BHLGNBQWMsRUFBRSxvQkFBb0I7SUFDcEMsVUFBVSxFQUFFO1FBQ1gsV0FBVyxFQUFFLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSxrRUFBa0UsQ0FBQztRQUN2SCxJQUFJLEVBQUUsT0FBTztRQUNiLEtBQUssRUFBRTtZQUNOLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNYLEVBQUUsRUFBRTtvQkFDSCxXQUFXLEVBQUUsUUFBUSxDQUFDLCtCQUErQixFQUFFLG9DQUFvQyxDQUFDO29CQUM1RixJQUFJLEVBQUUs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