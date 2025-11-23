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
import { localize } from '../../../../../nls.js';
import * as extensionsRegistry from '../../../../services/extensions/common/extensionsRegistry.js';
import { joinPath, isEqualOrParent } from '../../../../../base/common/resources.js';
import { IPromptsService } from './service/promptsService.js';
import { PromptsType } from './promptTypes.js';
import { DisposableMap } from '../../../../../base/common/lifecycle.js';
function registerChatFilesExtensionPoint(point) {
    return extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
        extensionPoint: point,
        jsonSchema: {
            description: localize('chatContribution.schema.description', 'Contributes {0} for chat prompts.', point),
            type: 'array',
            items: {
                additionalProperties: false,
                type: 'object',
                defaultSnippets: [{
                        body: {
                            name: 'exampleName',
                            path: './relative/path/to/file.md',
                            description: 'Optional description'
                        }
                    }],
                required: ['name', 'path'],
                properties: {
                    name: {
                        description: localize('chatContribution.property.name', 'Identifier for this file. Must be unique within this extension for this contribution point.'),
                        type: 'string',
                        pattern: '^[\\w.-]+$'
                    },
                    path: {
                        description: localize('chatContribution.property.path', 'Path to the file relative to the extension root.'),
                        type: 'string'
                    },
                    description: {
                        description: localize('chatContribution.property.description', '(Optional) Description of the file.'),
                        type: 'string'
                    }
                }
            }
        }
    });
}
const epPrompt = registerChatFilesExtensionPoint('chatPromptFiles');
const epInstructions = registerChatFilesExtensionPoint('chatInstructions');
const epAgents = registerChatFilesExtensionPoint('chatAgents');
function pointToType(contributionPoint) {
    switch (contributionPoint) {
        case 'chatPromptFiles': return PromptsType.prompt;
        case 'chatInstructions': return PromptsType.instructions;
        case 'chatAgents': return PromptsType.agent;
    }
}
function key(extensionId, type, name) {
    return `${extensionId.value}/${type}/${name}`;
}
let ChatPromptFilesExtensionPointHandler = class ChatPromptFilesExtensionPointHandler {
    static { this.ID = 'workbench.contrib.chatPromptFilesExtensionPointHandler'; }
    constructor(promptsService) {
        this.promptsService = promptsService;
        this.registrations = new DisposableMap();
        this.handle(epPrompt, 'chatPromptFiles');
        this.handle(epInstructions, 'chatInstructions');
        this.handle(epAgents, 'chatAgents');
    }
    handle(extensionPoint, contributionPoint) {
        extensionPoint.setHandler((_extensions, delta) => {
            for (const ext of delta.added) {
                const type = pointToType(contributionPoint);
                for (const raw of ext.value) {
                    if (!raw.name || !raw.name.match(/^[\w.-]+$/)) {
                        ext.collector.error(localize('extension.invalid.name', "Extension '{0}' cannot register {1} entry with invalid name '{2}'.", ext.description.identifier.value, contributionPoint, raw.name));
                        continue;
                    }
                    if (!raw.path) {
                        ext.collector.error(localize('extension.missing.path', "Extension '{0}' cannot register {1} entry '{2}' without path.", ext.description.identifier.value, contributionPoint, raw.name));
                        continue;
                    }
                    if (!raw.description) {
                        ext.collector.error(localize('extension.missing.description', "Extension '{0}' cannot register {1} entry '{2}' without description.", ext.description.identifier.value, contributionPoint, raw.name));
                        continue;
                    }
                    const fileUri = joinPath(ext.description.extensionLocation, raw.path);
                    if (!isEqualOrParent(fileUri, ext.description.extensionLocation)) {
                        ext.collector.error(localize('extension.invalid.path', "Extension '{0}' {1} entry '{2}' path resolves outside the extension.", ext.description.identifier.value, contributionPoint, raw.name));
                        continue;
                    }
                    try {
                        const d = this.promptsService.registerContributedFile(type, raw.name, raw.description, fileUri, ext.description);
                        this.registrations.set(key(ext.description.identifier, type, raw.name), d);
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        ext.collector.error(localize('extension.registration.failed', "Failed to register {0} entry '{1}': {2}", contributionPoint, raw.name, msg));
                    }
                }
            }
            for (const ext of delta.removed) {
                const type = pointToType(contributionPoint);
                for (const raw of ext.value) {
                    this.registrations.deleteAndDispose(key(ext.description.identifier, type, raw.name));
                }
            }
        });
    }
};
ChatPromptFilesExtensionPointHandler = __decorate([
    __param(0, IPromptsService)
], ChatPromptFilesExtensionPointHandler);
export { ChatPromptFilesExtensionPointHandler };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFByb21wdEZpbGVzQ29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9jaGF0UHJvbXB0RmlsZXNDb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRWpELE9BQU8sS0FBSyxrQkFBa0IsTUFBTSw4REFBOEQsQ0FBQztBQUVuRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBVXhFLFNBQVMsK0JBQStCLENBQUMsS0FBNEI7SUFDcEUsT0FBTyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBNkI7UUFDL0YsY0FBYyxFQUFFLEtBQUs7UUFDckIsVUFBVSxFQUFFO1lBQ1gsV0FBVyxFQUFFLFFBQVEsQ0FBQyxxQ0FBcUMsRUFBRSxtQ0FBbUMsRUFBRSxLQUFLLENBQUM7WUFDeEcsSUFBSSxFQUFFLE9BQU87WUFDYixLQUFLLEVBQUU7Z0JBQ04sb0JBQW9CLEVBQUUsS0FBSztnQkFDM0IsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsZUFBZSxFQUFFLENBQUM7d0JBQ2pCLElBQUksRUFBRTs0QkFDTCxJQUFJLEVBQUUsYUFBYTs0QkFDbkIsSUFBSSxFQUFFLDRCQUE0Qjs0QkFDbEMsV0FBVyxFQUFFLHNCQUFzQjt5QkFDbkM7cUJBQ0QsQ0FBQztnQkFDRixRQUFRLEVBQUUsQ0FB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