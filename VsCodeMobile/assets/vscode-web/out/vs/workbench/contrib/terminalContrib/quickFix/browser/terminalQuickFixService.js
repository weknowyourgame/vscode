/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { isProposedApiEnabled } from '../../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../../services/extensions/common/extensionsRegistry.js';
export class TerminalQuickFixService {
    get providers() { return this._providers; }
    constructor() {
        this._selectors = new Map();
        this._providers = new Map();
        this._pendingProviders = new Map();
        this._onDidRegisterProvider = new Emitter();
        this.onDidRegisterProvider = this._onDidRegisterProvider.event;
        this._onDidRegisterCommandSelector = new Emitter();
        this.onDidRegisterCommandSelector = this._onDidRegisterCommandSelector.event;
        this._onDidUnregisterProvider = new Emitter();
        this.onDidUnregisterProvider = this._onDidUnregisterProvider.event;
        this.extensionQuickFixes = new Promise((r) => quickFixExtensionPoint.setHandler(fixes => {
            r(fixes.filter(c => isProposedApiEnabled(c.description, 'terminalQuickFixProvider')).map(c => {
                if (!c.value) {
                    return [];
                }
                return c.value.map(fix => { return { ...fix, extensionIdentifier: c.description.identifier.value }; });
            }).flat());
        }));
        this.extensionQuickFixes.then(selectors => {
            for (const selector of selectors) {
                this.registerCommandSelector(selector);
            }
        });
    }
    registerCommandSelector(selector) {
        this._selectors.set(selector.id, selector);
        this._onDidRegisterCommandSelector.fire(selector);
        // Check if there's a pending provider for this selector
        const pendingProvider = this._pendingProviders.get(selector.id);
        if (pendingProvider) {
            this._pendingProviders.delete(selector.id);
            this._providers.set(selector.id, pendingProvider);
            this._onDidRegisterProvider.fire({ selector, provider: pendingProvider });
        }
    }
    registerQuickFixProvider(id, provider) {
        // This is more complicated than it looks like it should be because we need to return an
        // IDisposable synchronously but we must await ITerminalContributionService.quickFixes
        // asynchronously before actually registering the provider.
        let disposed = false;
        this.extensionQuickFixes.then(() => {
            if (disposed) {
                return;
            }
            const selector = this._selectors.get(id);
            if (selector) {
                // Selector is already available, register immediately
                this._providers.set(id, provider);
                this._onDidRegisterProvider.fire({ selector, provider });
            }
            else {
                // Selector not yet available, store provider as pending
                this._pendingProviders.set(id, provider);
            }
        });
        return toDisposable(() => {
            disposed = true;
            this._providers.delete(id);
            this._pendingProviders.delete(id);
            const selector = this._selectors.get(id);
            if (selector) {
                this._selectors.delete(id);
                this._onDidUnregisterProvider.fire(selector.id);
            }
        });
    }
}
const quickFixExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'terminalQuickFixes',
    defaultExtensionKind: ['workspace'],
    activationEventsGenerator: function* (terminalQuickFixes) {
        for (const quickFixContrib of terminalQuickFixes ?? []) {
            yield `onTerminalQuickFixRequest:${quickFixContrib.id}`;
        }
    },
    jsonSchema: {
        description: localize('vscode.extension.contributes.terminalQuickFixes', 'Contributes terminal quick fixes.'),
        type: 'array',
        items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'commandLineMatcher', 'outputMatcher', 'commandExitResult'],
            defaultSnippets: [{
                    body: {
                        id: '$1',
                        commandLineMatcher: '$2',
                        outputMatcher: '$3',
                        exitStatus: '$4'
                    }
                }],
            properties: {
                id: {
                    description: localize('vscode.extension.contributes.terminalQuickFixes.id', "The ID of the quick fix provider"),
                    type: 'string',
                },
                commandLineMatcher: {
                    description: localize('vscode.extension.contributes.terminalQuickFixes.commandLineMatcher', "A regular expression or string to test the command line against"),
                    type: 'string',
                },
                outputMatcher: {
                    markdownDescription: localize('vscode.extension.contributes.terminalQuickFixes.outputMatcher', "A regular expression or string to match a single line of the output against, which provides groups to be referenced in terminalCommand and uri.\n\nFor example:\n\n `lineMatcher: /git push --set-upstream origin (?<branchName>[^\s]+)/;`\n\n`terminalCommand: 'git push --set-upstream origin ${group:branchName}';`\n"),
                    type: 'object',
                    required: ['lineMatcher', 'anchor', 'offset', 'length'],
                    properties: {
                        lineMatcher: {
                            description: 'A regular expression or string to test the command line against',
                            type: 'string'
                        },
                        anchor: {
                            description: 'Where the search should begin in the buffer',
                            enum: ['top', 'bottom']
                        },
                        offset: {
                            description: 'The number of lines vertically from the anchor in the buffer to start matching against',
                            type: 'number'
                        },
                        length: {
                            description: 'The number of rows to match against, this should be as small as possible for performance reasons',
                            type: 'number'
                        }
                    }
                },
                commandExitResult: {
                    description: localize('vscode.extension.contributes.terminalQuickFixes.commandExitResult', "The command exit result to match on"),
                    enum: ['success', 'error'],
                    enumDescriptions: [
                        'The command exited with an exit code of zero.',
                        'The command exited with a non-zero exit code.'
                    ]
                },
                kind: {
                    description: localize('vscode.extension.contributes.terminalQuickFixes.kind', "The kind of the resulting quick fix. This changes how the quick fix is presented. Defaults to {0}.", '`"fix"`'),
                    enum: ['default', 'explain'],
                    enumDescriptions: [
                        'A high confidence quick fix.',
                        'An explanation of the problem.'
                    ]
                }
            },
        }
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxRdWlja0ZpeFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3F1aWNrRml4L2Jyb3dzZXIvdGVybWluYWxRdWlja0ZpeFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFHakQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDNUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFbEcsTUFBTSxPQUFPLHVCQUF1QjtJQU1uQyxJQUFJLFNBQVMsS0FBNkMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQWFuRjtRQWhCUSxlQUFVLEdBQTBDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFOUQsZUFBVSxHQUEyQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRy9ELHNCQUFpQixHQUEyQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRTdELDJCQUFzQixHQUFHLElBQUksT0FBTyxFQUFxQyxDQUFDO1FBQ2xGLDBCQUFxQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUM7UUFDbEQsa0NBQTZCLEdBQUcsSUFBSSxPQUFPLEVBQTRCLENBQUM7UUFDaEYsaUNBQTRCLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQztRQUNoRSw2QkFBd0IsR0FBRyxJQUFJLE9BQU8sRUFBVSxDQUFDO1FBQ3pELDRCQUF1QixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FB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