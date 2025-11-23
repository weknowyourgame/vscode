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
import { coalesce, isNonEmptyArray } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { Event } from '../../../../base/common/event.js';
import { createCommandUri, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import { localize, localize2 } from '../../../../nls.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions } from '../../../common/views.js';
import { Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import * as extensionsRegistry from '../../../services/extensions/common/extensionsRegistry.js';
import { showExtensionsWithIdsCommandId } from '../../extensions/browser/extensionsActions.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ChatAgentLocation, ChatModeKind } from '../common/constants.js';
import { ChatViewId } from './chat.js';
import { CHAT_SIDEBAR_PANEL_ID, ChatViewPane } from './chatViewPane.js';
// --- Chat Container &  View Registration
const chatViewContainer = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer({
    id: CHAT_SIDEBAR_PANEL_ID,
    title: localize2('chat.viewContainer.label', "Chat"),
    icon: Codicon.chatSparkle,
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [CHAT_SIDEBAR_PANEL_ID, { mergeViewWithContainerWhenSingleView: true }]),
    storageId: CHAT_SIDEBAR_PANEL_ID,
    hideIfEmpty: true,
    order: 1,
}, 2 /* ViewContainerLocation.AuxiliaryBar */, { isDefault: true, doNotRegisterOpenCommand: true });
const chatViewDescriptor = {
    id: ChatViewId,
    containerIcon: chatViewContainer.icon,
    containerTitle: chatViewContainer.title.value,
    singleViewPaneContainerTitle: chatViewContainer.title.value,
    name: localize2('chat.viewContainer.label', "Chat"),
    canToggleVisibility: false,
    canMoveView: true,
    openCommandActionDescriptor: {
        id: CHAT_SIDEBAR_PANEL_ID,
        title: chatViewContainer.title,
        mnemonicTitle: localize({ key: 'miToggleChat', comment: ['&& denotes a mnemonic'] }, "&&Chat"),
        keybindings: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 39 /* KeyCode.KeyI */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 39 /* KeyCode.KeyI */
            }
        },
        order: 1
    },
    ctorDescriptor: new SyncDescriptor(ChatViewPane, [{ location: ChatAgentLocation.Chat }]),
    when: ContextKeyExpr.or(ContextKeyExpr.or(ChatContextKeys.Setup.hidden, ChatContextKeys.Setup.disabled)?.negate(), ChatContextKeys.panelParticipantRegistered, ChatContextKeys.extensionInvalid)
};
Registry.as(ViewExtensions.ViewsRegistry).registerViews([chatViewDescriptor], chatViewContainer);
const chatParticipantExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'chatParticipants',
    jsonSchema: {
        description: localize('vscode.extension.contributes.chatParticipant', 'Contributes a chat participant'),
        type: 'array',
        items: {
            additionalProperties: false,
            type: 'object',
            defaultSnippets: [{ body: { name: '', description: '' } }],
            required: ['name', 'id'],
            properties: {
                id: {
                    description: localize('chatParticipantId', "A unique id for this chat participant."),
                    type: 'string'
                },
                name: {
                    description: localize('chatParticipantName', "User-facing name for this chat participant. The user will use '@' with this name to invoke the participant. Name must not contain whitespace."),
                    type: 'string',
                    pattern: '^[\\w-]+$'
                },
                fullName: {
                    markdownDescription: localize('chatParticipantFullName', "The full name of this chat participant, which is shown as the label for responses coming from this participant. If not provided, {0} is used.", '`name`'),
                    type: 'string'
                },
                description: {
                    description: localize('chatParticipantDescription', "A description of this chat participant, shown in the UI."),
                    type: 'string'
                },
                isSticky: {
                    description: localize('chatCommandSticky', "Whether invoking the command puts the chat into a persistent mode, where the command is automatically added to the chat input for the next message."),
                    type: 'boolean'
                },
                sampleRequest: {
                    description: localize('chatSampleRequest', "When the user clicks this participant in `/help`, this text will be submitted to the participant."),
                    type: 'string'
                },
                when: {
                    description: localize('chatParticipantWhen', "A condition which must be true to enable this participant."),
                    type: 'string'
                },
                disambiguation: {
                    description: localize('chatParticipantDisambiguation', "Metadata to help with automatically routing user questions to this chat participant."),
                    type: 'array',
                    items: {
                        additionalProperties: false,
                        type: 'object',
                        defaultSnippets: [{ body: { category: '', description: '', examples: [] } }],
                        required: ['category', 'description', 'examples'],
                        properties: {
                            category: {
                                markdownDescription: localize('chatParticipantDisambiguationCategory', "A detailed name for this category, e.g. `workspace_questions` or `web_questions`."),
                                type: 'string'
                            },
                            description: {
                                description: localize('chatParticipantDisambiguationDescription', "A detailed description of the kinds of questions that are suitable for this chat participant."),
                                type: 'string'
                            },
                            examples: {
                                description: localize('chatParticipantDisambiguationExamples', "A list of representative example questions that are suitable for this chat participant."),
                                type: 'array'
                            },
                        }
                    }
                },
                commands: {
                    markdownDescription: localize('chatCommandsDescription', "Commands available for this chat participant, which the user can invoke with a `/`."),
                    type: 'array',
                    items: {
                        additionalProperties: false,
                        type: 'object',
                        defaultSnippets: [{ body: { name: '', description: '' } }],
                        required: ['name'],
                        properties: {
                            name: {
                                description: localize('chatCommand', "A short name by which this command is referred to in the UI, e.g. `fix` or `explain` for commands that fix an issue or explain code. The name should be unique among the commands provided by this participant."),
                                type: 'string'
                            },
                            description: {
                                description: localize('chatCommandDescription', "A description of this command."),
                                type: 'string'
                            },
                            when: {
                                description: localize('chatCommandWhen', "A condition which must be true to enable this command."),
                                type: 'string'
                            },
                            sampleRequest: {
                                description: localize('chatCommandSampleRequest', "When the user clicks this command in `/help`, this text will be submitted to the participant."),
                                type: 'string'
                            },
                            isSticky: {
                                description: localize('chatCommandSticky', "Whether invoking the command puts the chat into a persistent mode, where the command is automatically added to the chat input for the next message."),
                                type: 'boolean'
                            },
                            disambiguation: {
                                description: localize('chatCommandDisambiguation', "Metadata to help with automatically routing user questions to this chat command."),
                                type: 'array',
                                items: {
                                    additionalProperties: false,
                                    type: 'object',
                                    defaultSnippets: [{ body: { category: '', description: '', examples: [] } }],
                                    required: ['category', 'description', 'examples'],
                                    properties: {
                                        category: {
                                            markdownDescription: localize('chatCommandDisambiguationCategory', "A detailed name for this category, e.g. `workspace_questions` or `web_questions`."),
                                            type: 'string'
                                        },
                                        description: {
                                            description: localize('chatCommandDisambiguationDescription', "A detailed description of the kinds of questions that are suitable for this chat command."),
                                            type: 'string'
                                        },
                                        examples: {
                                            description: localize('chatCommandDisambiguationExamples', "A list of representative example questions that are suitable for this chat command."),
                                            type: 'array'
                                        },
                                    }
                                }
                            }
                        }
                    }
                },
            }
        }
    },
    activationEventsGenerator: function* (contributions) {
        for (const contrib of contributions) {
            yield `onChatParticipant:${contrib.id}`;
        }
    },
});
let ChatExtensionPointHandler = class ChatExtensionPointHandler {
    static { this.ID = 'workbench.contrib.chatExtensionPointHandler'; }
    constructor(_chatAgentService) {
        this._chatAgentService = _chatAgentService;
        this._participantRegistrationDisposables = new DisposableMap();
        this.handleAndRegisterChatExtensions();
    }
    handleAndRegisterChatExtensions() {
        chatParticipantExtensionPoint.setHandler((extensions, delta) => {
            for (const extension of delta.added) {
                for (const providerDescriptor of extension.value) {
                    if (!providerDescriptor.name?.match(/^[\w-]+$/)) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with invalid name: ${providerDescriptor.name}. Name must match /^[\\w-]+$/.`);
                        continue;
                    }
                    if (providerDescriptor.fullName && strings.AmbiguousCharacters.getInstance(new Set()).containsAmbiguousCharacter(providerDescriptor.fullName)) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with fullName that contains ambiguous characters: ${providerDescriptor.fullName}.`);
                        continue;
                    }
                    // Spaces are allowed but considered "invisible"
                    if (providerDescriptor.fullName && strings.InvisibleCharacters.containsInvisibleCharacter(providerDescriptor.fullName.replace(/ /g, ''))) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with fullName that contains invisible characters: ${providerDescriptor.fullName}.`);
                        continue;
                    }
                    if ((providerDescriptor.isDefault || providerDescriptor.modes) && !isProposedApiEnabled(extension.description, 'defaultChatParticipant')) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT use API proposal: defaultChatParticipant.`);
                        continue;
                    }
                    if (providerDescriptor.locations && !isProposedApiEnabled(extension.description, 'chatParticipantAdditions')) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT use API proposal: chatParticipantAdditions.`);
                        continue;
                    }
                    if (!providerDescriptor.id || !providerDescriptor.name) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register participant without both id and name.`);
                        continue;
                    }
                    const participantsDisambiguation = [];
                    if (providerDescriptor.disambiguation?.length) {
                        participantsDisambiguation.push(...providerDescriptor.disambiguation.map((d) => ({
                            ...d, category: d.category ?? d.categoryName
                        })));
                    }
                    try {
                        const store = new DisposableStore();
                        store.add(this._chatAgentService.registerAgent(providerDescriptor.id, {
                            extensionId: extension.description.identifier,
                            extensionVersion: extension.description.version,
                            publisherDisplayName: extension.description.publisherDisplayName ?? extension.description.publisher, // May not be present in OSS
                            extensionPublisherId: extension.description.publisher,
                            extensionDisplayName: extension.description.displayName ?? extension.description.name,
                            id: providerDescriptor.id,
                            description: providerDescriptor.description,
                            when: providerDescriptor.when,
                            metadata: {
                                isSticky: providerDescriptor.isSticky,
                                sampleRequest: providerDescriptor.sampleRequest,
                            },
                            name: providerDescriptor.name,
                            fullName: providerDescriptor.fullName,
                            isDefault: providerDescriptor.isDefault,
                            locations: isNonEmptyArray(providerDescriptor.locations) ?
                                providerDescriptor.locations.map(ChatAgentLocation.fromRaw) :
                                [ChatAgentLocation.Chat],
                            modes: providerDescriptor.isDefault ? (providerDescriptor.modes ?? [ChatModeKind.Ask]) : [ChatModeKind.Agent, ChatModeKind.Ask, ChatModeKind.Edit],
                            slashCommands: providerDescriptor.commands ?? [],
                            disambiguation: coalesce(participantsDisambiguation.flat()),
                        }));
                        this._participantRegistrationDisposables.set(getParticipantKey(extension.description.identifier, providerDescriptor.id), store);
                    }
                    catch (e) {
                        extension.collector.error(`Failed to register participant ${providerDescriptor.id}: ${toErrorMessage(e, true)}`);
                    }
                }
            }
            for (const extension of delta.removed) {
                for (const providerDescriptor of extension.value) {
                    this._participantRegistrationDisposables.deleteAndDispose(getParticipantKey(extension.description.identifier, providerDescriptor.id));
                }
            }
        });
    }
};
ChatExtensionPointHandler = __decorate([
    __param(0, IChatAgentService)
], ChatExtensionPointHandler);
export { ChatExtensionPointHandler };
function getParticipantKey(extensionId, participantName) {
    return `${extensionId.value}_${participantName}`;
}
let ChatCompatibilityNotifier = class ChatCompatibilityNotifier extends Disposable {
    static { this.ID = 'workbench.contrib.chatCompatNotifier'; }
    constructor(extensionsWorkbenchService, contextKeyService, productService) {
        super();
        this.productService = productService;
        this.registeredWelcomeView = false;
        // It may be better to have some generic UI for this, for any extension that is incompatible,
        // but this is only enabled for Chat now and it needs to be obvious.
        const isInvalid = ChatContextKeys.extensionInvalid.bindTo(contextKeyService);
        this._register(Event.runAndSubscribe(extensionsWorkbenchService.onDidChangeExtensionsNotification, () => {
            const notification = extensionsWorkbenchService.getExtensionsNotification();
            const chatExtension = notification?.extensions.find(ext => ExtensionIdentifier.equals(ext.identifier.id, this.productService.defaultChatAgent?.chatExtensionId));
            if (chatExtension) {
                isInvalid.set(true);
                this.registerWelcomeView(chatExtension);
            }
            else {
                isInvalid.set(false);
            }
        }));
    }
    registerWelcomeView(chatExtension) {
        if (this.registeredWelcomeView) {
            return;
        }
        this.registeredWelcomeView = true;
        const showExtensionLabel = localize('showExtension', "Show Extension");
        const mainMessage = localize('chatFailErrorMessage', "Chat failed to load because the installed version of the Copilot Chat extension is not compatible with this version of {0}. Please ensure that the Copilot Chat extension is up to date.", this.productService.nameLong);
        const commandButton = `[${showExtensionLabel}](${createCommandUri(showExtensionsWithIdsCommandId, [this.productService.defaultChatAgent?.chatExtensionId])})`;
        const versionMessage = `Copilot Chat version: ${chatExtension.version}`;
        const viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
        this._register(viewsRegistry.registerViewWelcomeContent(ChatViewId, {
            content: [mainMessage, commandButton, versionMessage].join('\n\n'),
            when: ChatContextKeys.extensionInvalid,
        }));
    }
};
ChatCompatibilityNotifier = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IContextKeyService),
    __param(2, IProductService)
], ChatCompatibilityNotifier);
export { ChatCompatibilityNotifier };
class ChatParticipantDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.chatParticipants;
    }
    render(manifest) {
        const nonDefaultContributions = manifest.contributes?.chatParticipants?.filter(c => !c.isDefault) ?? [];
        if (!nonDefaultContributions.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            localize('participantName', "Name"),
            localize('participantFullName', "Full Name"),
            localize('participantDescription', "Description"),
            localize('participantCommands', "Commands"),
        ];
        const rows = nonDefaultContributions.map(d => {
            return [
                '@' + d.name,
                d.fullName,
                d.description ?? '-',
                d.commands?.length ? new MarkdownString(d.commands.map(c => `- /` + c.name).join('\n')) : '-'
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'chatParticipants',
    label: localize('chatParticipants', "Chat Participants"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(ChatParticipantDataRenderer),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFBhcnRpY2lwYW50LmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFBhcnRpY2lwYW50LmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUUxRixPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRyxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxtQkFBbUIsRUFBc0IsTUFBTSxzREFBc0QsQ0FBQztBQUMvRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUV0RixP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