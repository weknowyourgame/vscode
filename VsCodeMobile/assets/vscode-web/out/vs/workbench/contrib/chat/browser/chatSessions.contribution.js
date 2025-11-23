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
import { sep } from '../../../../base/common/path.js';
import { raceCancellationError } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import * as resources from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, IMenuService, MenuId, MenuItemAction, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { isDark } from '../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService, isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { ChatEditorInput } from '../browser/chatEditorInput.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { IChatSessionsService, localChatSessionType } from '../common/chatSessionsService.js';
import { LEGACY_AGENT_SESSIONS_VIEW_ID, ChatAgentLocation, ChatModeKind } from '../common/constants.js';
import { CHAT_CATEGORY } from './actions/chatActions.js';
import { NEW_CHAT_SESSION_ACTION_ID } from './chatSessions/common.js';
import { autorunSelfDisposable } from '../../../../base/common/observable.js';
const extensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'chatSessions',
    jsonSchema: {
        description: localize('chatSessionsExtPoint', 'Contributes chat session integrations to the chat widget.'),
        type: 'array',
        items: {
            type: 'object',
            additionalProperties: false,
            properties: {
                type: {
                    description: localize('chatSessionsExtPoint.chatSessionType', 'Unique identifier for the type of chat session.'),
                    type: 'string',
                },
                name: {
                    description: localize('chatSessionsExtPoint.name', 'Name of the dynamically registered chat participant (eg: @agent). Must not contain whitespace.'),
                    type: 'string',
                    pattern: '^[\\w-]+$'
                },
                displayName: {
                    description: localize('chatSessionsExtPoint.displayName', 'A longer name for this item which is used for display in menus.'),
                    type: 'string',
                },
                description: {
                    description: localize('chatSessionsExtPoint.description', 'Description of the chat session for use in menus and tooltips.'),
                    type: 'string'
                },
                when: {
                    description: localize('chatSessionsExtPoint.when', 'Condition which must be true to show this item.'),
                    type: 'string'
                },
                icon: {
                    description: localize('chatSessionsExtPoint.icon', 'Icon identifier (codicon ID) for the chat session editor tab. For example, "$(github)" or "$(cloud)".'),
                    anyOf: [{
                            type: 'string'
                        },
                        {
                            type: 'object',
                            properties: {
                                light: {
                                    description: localize('icon.light', 'Icon path when a light theme is used'),
                                    type: 'string'
                                },
                                dark: {
                                    description: localize('icon.dark', 'Icon path when a dark theme is used'),
                                    type: 'string'
                                }
                            }
                        }]
                },
                order: {
                    description: localize('chatSessionsExtPoint.order', 'Order in which this item should be displayed.'),
                    type: 'integer'
                },
                alternativeIds: {
                    description: localize('chatSessionsExtPoint.alternativeIds', 'Alternative identifiers for backward compatibility.'),
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                },
                welcomeTitle: {
                    description: localize('chatSessionsExtPoint.welcomeTitle', 'Title text to display in the chat welcome view for this session type.'),
                    type: 'string'
                },
                welcomeMessage: {
                    description: localize('chatSessionsExtPoint.welcomeMessage', 'Message text (supports markdown) to display in the chat welcome view for this session type.'),
                    type: 'string'
                },
                welcomeTips: {
                    description: localize('chatSessionsExtPoint.welcomeTips', 'Tips text (supports markdown and theme icons) to display in the chat welcome view for this session type.'),
                    type: 'string'
                },
                inputPlaceholder: {
                    description: localize('chatSessionsExtPoint.inputPlaceholder', 'Placeholder text to display in the chat input box for this session type.'),
                    type: 'string'
                },
                capabilities: {
                    description: localize('chatSessionsExtPoint.capabilities', 'Optional capabilities for this chat session.'),
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        supportsFileAttachments: {
                            description: localize('chatSessionsExtPoint.supportsFileAttachments', 'Whether this chat session supports attaching files or file references.'),
                            type: 'boolean'
                        },
                        supportsToolAttachments: {
                            description: localize('chatSessionsExtPoint.supportsToolAttachments', 'Whether this chat session supports attaching tools or tool references.'),
                            type: 'boolean'
                        },
                        supportsMCPAttachments: {
                            description: localize('chatSessionsExtPoint.supportsMCPAttachments', 'Whether this chat session supports attaching MCP resources.'),
                            type: 'boolean'
                        },
                        supportsImageAttachments: {
                            description: localize('chatSessionsExtPoint.supportsImageAttachments', 'Whether this chat session supports attaching images.'),
                            type: 'boolean'
                        },
                        supportsSearchResultAttachments: {
                            description: localize('chatSessionsExtPoint.supportsSearchResultAttachments', 'Whether this chat session supports attaching search results.'),
                            type: 'boolean'
                        },
                        supportsInstructionAttachments: {
                            description: localize('chatSessionsExtPoint.supportsInstructionAttachments', 'Whether this chat session supports attaching instructions.'),
                            type: 'boolean'
                        },
                        supportsSourceControlAttachments: {
                            description: localize('chatSessionsExtPoint.supportsSourceControlAttachments', 'Whether this chat session supports attaching source control changes.'),
                            type: 'boolean'
                        },
                        supportsProblemAttachments: {
                            description: localize('chatSessionsExtPoint.supportsProblemAttachments', 'Whether this chat session supports attaching problems.'),
                            type: 'boolean'
                        },
                        supportsSymbolAttachments: {
                            description: localize('chatSessionsExtPoint.supportsSymbolAttachments', 'Whether this chat session supports attaching symbols.'),
                            type: 'boolean'
                        }
                    }
                },
                commands: {
                    markdownDescription: localize('chatCommandsDescription', "Commands available for this chat session, which the user can invoke with a `/`."),
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
                        }
                    }
                },
                canDelegate: {
                    description: localize('chatSessionsExtPoint.canDelegate', 'Whether delegation is supported. Defaults to true.'),
                    type: 'boolean',
                    default: true
                }
            },
            required: ['type', 'name', 'displayName', 'description'],
        }
    },
    activationEventsGenerator: function* (contribs) {
        for (const contrib of contribs) {
            yield `onChatSession:${contrib.type}`;
        }
    }
});
class ContributedChatSessionData extends Disposable {
    getOption(optionId) {
        return this._optionsCache.get(optionId);
    }
    setOption(optionId, value) {
        this._optionsCache.set(optionId, value);
    }
    constructor(session, chatSessionType, resource, options, onWillDispose) {
        super();
        this.session = session;
        this.chatSessionType = chatSessionType;
        this.resource = resource;
        this.options = options;
        this.onWillDispose = onWillDispose;
        this._optionsCache = new Map();
        if (options) {
            for (const [key, value] of Object.entries(options)) {
                this._optionsCache.set(key, value);
            }
        }
        this._register(this.session.onWillDispose(() => {
            this.onWillDispose(this.resource);
        }));
    }
}
let ChatSessionsService = class ChatSessionsService extends Disposable {
    get onDidChangeInProgress() { return this._onDidChangeInProgress.event; }
    get onDidChangeContentProviderSchemes() { return this._onDidChangeContentProviderSchemes.event; }
    constructor(_logService, _chatAgentService, _extensionService, _contextKeyService, _menuService, _themeService, _labelService) {
        super();
        this._logService = _logService;
        this._chatAgentService = _chatAgentService;
        this._extensionService = _extensionService;
        this._contextKeyService = _contextKeyService;
        this._menuService = _menuService;
        this._themeService = _themeService;
        this._labelService = _labelService;
        this._itemsProviders = new Map();
        this._contributions = new Map();
        this._contributionDisposables = this._register(new DisposableMap());
        this._contentProviders = new Map();
        this._alternativeIdMap = new Map();
        this._contextKeys = new Set();
        this._onDidChangeItemsProviders = this._register(new Emitter());
        this.onDidChangeItemsProviders = this._onDidChangeItemsProviders.event;
        this._onDidChangeSessionItems = this._register(new Emitter());
        this.onDidChangeSessionItems = this._onDidChangeSessionItems.event;
        this._onDidChangeAvailability = this._register(new Emitter());
        this.onDidChangeAvailability = this._onDidChangeAvailability.event;
        this._onDidChangeInProgress = this._register(new Emitter());
        this._onDidChangeContentProviderSchemes = this._register(new Emitter());
        this.inProgressMap = new Map();
        this._sessionTypeOptions = new Map();
        this._sessionTypeIcons = new Map();
        this._sessionTypeWelcomeTitles = new Map();
        this._sessionTypeWelcomeMessages = new Map();
        this._sessionTypeWelcomeTips = new Map();
        this._sessionTypeInputPlaceholders = new Map();
        this._sessions = new ResourceMap();
        this._editableSessions = new ResourceMap();
        this._registeredRequestIds = new Set();
        this._registeredModels = new Set();
        this._register(extensionPoint.setHandler(extensions => {
            for (const ext of extensions) {
                if (!isProposedApiEnabled(ext.description, 'chatSessionsProvider')) {
                    continue;
                }
                if (!Array.isArray(ext.value)) {
                    continue;
                }
                for (const contribution of ext.value) {
                    this._register(this.registerContribution(contribution, ext.description));
                }
            }
        }));
        // Listen for context changes and re-evaluate contributions
        this._register(Event.filter(this._contextKeyService.onDidChangeContext, e => e.affectsSome(this._contextKeys))(() => {
            this._evaluateAvailability();
        }));
        this._register(this.onDidChangeSessionItems(chatSessionType => {
            this.updateInProgressStatus(chatSessionType).catch(error => {
                this._logService.warn(`Failed to update progress status for '${chatSessionType}':`, error);
            });
        }));
        this._register(this._labelService.registerFormatter({
            scheme: Schemas.copilotPr,
            formatting: {
                label: '${authority}${path}',
                separator: sep,
                stripPathStartingSeparator: true,
            }
        }));
    }
    reportInProgress(chatSessionType, count) {
        let displayName;
        if (chatSessionType === localChatSessionType) {
            displayName = 'Local Chat Agent';
        }
        else {
            displayName = this._contributions.get(chatSessionType)?.contribution.displayName;
        }
        if (displayName) {
            this.inProgressMap.set(displayName, count);
        }
        this._onDidChangeInProgress.fire();
    }
    getInProgress() {
        return Array.from(this.inProgressMap.entries()).map(([displayName, count]) => ({ displayName, count }));
    }
    async updateInProgressStatus(chatSessionType) {
        try {
            const items = await this.getChatSessionItems(chatSessionType, CancellationToken.None);
            const inProgress = items.filter(item => item.status === 2 /* ChatSessionStatus.InProgress */);
            this.reportInProgress(chatSessionType, inProgress.length);
        }
        catch (error) {
            this._logService.warn(`Failed to update in-progress status for chat session type '${chatSessionType}':`, error);
        }
    }
    registerContribution(contribution, ext) {
        if (this._contributions.has(contribution.type)) {
            return { dispose: () => { } };
        }
        // Track context keys from the when condition
        if (contribution.when) {
            const whenExpr = ContextKeyExpr.deserialize(contribution.when);
            if (whenExpr) {
                for (const key of whenExpr.keys()) {
                    this._contextKeys.add(key);
                }
            }
        }
        this._contributions.set(contribution.type, { contribution, extension: ext });
        // Register alternative IDs if provided
        if (contribution.alternativeIds) {
            for (const altId of contribution.alternativeIds) {
                if (this._alternativeIdMap.has(altId)) {
                    this._logService.warn(`Alternative ID '${altId}' is already mapped to '${this._alternativeIdMap.get(altId)}'. Remapping to '${contribution.type}'.`);
                }
                this._alternativeIdMap.set(altId, contribution.type);
            }
        }
        // Store icon mapping if provided
        let icon;
        if (contribution.icon) {
            // Parse icon string - support ThemeIcon format or file path from extension
            if (typeof contribution.icon === 'string') {
                icon = contribution.icon.startsWith('$(') && contribution.icon.endsWith(')')
                    ? ThemeIcon.fromString(contribution.icon)
                    : ThemeIcon.fromId(contribution.icon);
            }
            else {
                icon = {
                    dark: resources.joinPath(ext.extensionLocation, contribution.icon.dark),
                    light: resources.joinPath(ext.extensionLocation, contribution.icon.light)
                };
            }
        }
        if (icon) {
            this._sessionTypeIcons.set(contribution.type, icon);
        }
        // Store welcome title, message, tips, and input placeholder if provided
        if (contribution.welcomeTitle) {
            this._sessionTypeWelcomeTitles.set(contribution.type, contribution.welcomeTitle);
        }
        if (contribution.welcomeMessage) {
            this._sessionTypeWelcomeMessages.set(contribution.type, contribution.welcomeMessage);
        }
        if (contribution.welcomeTips) {
            this._sessionTypeWelcomeTips.set(contribution.type, contribution.welcomeTips);
        }
        if (contribution.inputPlaceholder) {
            this._sessionTypeInputPlaceholders.set(contribution.type, contribution.inputPlaceholder);
        }
        this._evaluateAvailability();
        return {
            dispose: () => {
                this._contributions.delete(contribution.type);
                // Remove alternative ID mappings
                if (contribution.alternativeIds) {
                    for (const altId of contribution.alternativeIds) {
                        if (this._alternativeIdMap.get(altId) === contribution.type) {
                            this._alternativeIdMap.delete(altId);
                        }
                    }
                }
                this._sessionTypeIcons.delete(contribution.type);
                this._sessionTypeWelcomeTitles.delete(contribution.type);
                this._sessionTypeWelcomeMessages.delete(contribution.type);
                this._sessionTypeWelcomeTips.delete(contribution.type);
                this._sessionTypeInputPlaceholders.delete(contribution.type);
                this._contributionDisposables.deleteAndDispose(contribution.type);
            }
        };
    }
    _isContributionAvailable(contribution) {
        if (!contribution.when) {
            return true;
        }
        const whenExpr = ContextKeyExpr.deserialize(contribution.when);
        return !whenExpr || this._contextKeyService.contextMatchesRules(whenExpr);
    }
    /**
     * Resolves a session type to its primary type, checking for alternative IDs.
     * @param sessionType The session type or alternative ID to resolve
     * @returns The primary session type, or undefined if not found or not available
     */
    _resolveToPrimaryType(sessionType) {
        // Try to find the primary type first
        const contribution = this._contributions.get(sessionType)?.contribution;
        if (contribution) {
            // If the contribution is available, use it
            if (this._isContributionAvailable(contribution)) {
                return sessionType;
            }
            // If not available, fall through to check for alternatives
        }
        // Check if this is an alternative ID, or if the primary type is not available
        const primaryType = this._alternativeIdMap.get(sessionType);
        if (primaryType) {
            const altContribution = this._contributions.get(primaryType)?.contribution;
            if (altContribution && this._isContributionAvailable(altContribution)) {
                this._logService.trace(`Resolving chat session type '${sessionType}' to alternative type '${primaryType}'`);
                return primaryType;
            }
        }
        return undefined;
    }
    _registerMenuItems(contribution, extensionDescription) {
        // If provider registers anything for the create submenu, let it fully control the creation
        const contextKeyService = this._contextKeyService.createOverlay([
            ['chatSessionType', contribution.type]
        ]);
        const rawMenuActions = this._menuService.getMenuActions(MenuId.ChatSessionsCreateSubMenu, contextKeyService);
        const menuActions = rawMenuActions.map(value => value[1]).flat();
        const whenClause = ContextKeyExpr.and(ContextKeyExpr.equals('view', `${LEGACY_AGENT_SESSIONS_VIEW_ID}.${contribution.type}`));
        // If there's exactly one action, inline it
        if (menuActions.length === 1) {
            const first = menuActions[0];
            if (first instanceof MenuItemAction) {
                return MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
                    group: 'navigation',
                    title: first.label,
                    icon: Codicon.plus,
                    order: 1,
                    when: whenClause,
                    command: first.item,
                });
            }
        }
        if (menuActions.length) {
            return MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
                group: 'navigation',
                title: localize('interactiveSession.chatSessionSubMenuTitle', "Create chat session"),
                icon: Codicon.plus,
                order: 1,
                when: whenClause,
                submenu: MenuId.ChatSessionsCreateSubMenu,
                isSplitButton: menuActions.length > 1
            });
        }
        else {
            // We control creation instead
            return MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
                command: {
                    id: `${NEW_CHAT_SESSION_ACTION_ID}.${contribution.type}`,
                    title: localize('interactiveSession.openNewSessionEditor', "New {0}", contribution.displayName),
                    icon: Codicon.plus,
                    source: {
                        id: extensionDescription.identifier.value,
                        title: extensionDescription.displayName || extensionDescription.name,
                    }
                },
                group: 'navigation',
                order: 1,
                when: whenClause,
            });
        }
    }
    _registerCommands(contribution) {
        return registerAction2(class OpenNewChatSessionEditorAction extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.chat.openNewSessionEditor.${contribution.type}`,
                    title: localize2('interactiveSession.openNewSessionEditor', "New {0}", contribution.displayName),
                    category: CHAT_CATEGORY,
                    icon: Codicon.plus,
                    f1: true, // Show in command palette
                    precondition: ChatContextKeys.enabled
                });
            }
            async run(accessor) {
                const editorService = accessor.get(IEditorService);
                const logService = accessor.get(ILogService);
                const { type } = contribution;
                try {
                    const options = {
                        override: ChatEditorInput.EditorID,
                        pinned: true,
                        title: {
                            fallback: localize('chatEditorContributionName', "{0}", contribution.displayName),
                        }
                    };
                    const resource = URI.from({
                        scheme: type,
                        path: `/untitled-${generateUuid()}`,
                    });
                    await editorService.openEditor({ resource, options });
                }
                catch (e) {
                    logService.error(`Failed to open new '${type}' chat session editor`, e);
                }
            }
        });
    }
    _evaluateAvailability() {
        let hasChanges = false;
        for (const { contribution, extension } of this._contributions.values()) {
            const isCurrentlyRegistered = this._contributionDisposables.has(contribution.type);
            const shouldBeRegistered = this._isContributionAvailable(contribution);
            if (isCurrentlyRegistered && !shouldBeRegistered) {
                // Disable the contribution by disposing its disposable store
                this._contributionDisposables.deleteAndDispose(contribution.type);
                // Also dispose any cached sessions for this contribution
                this._disposeSessionsForContribution(contribution.type);
                hasChanges = true;
            }
            else if (!isCurrentlyRegistered && shouldBeRegistered) {
                // Enable the contribution by registering it
                this._enableContribution(contribution, extension);
                hasChanges = true;
            }
        }
        if (hasChanges) {
            this._onDidChangeAvailability.fire();
            for (const provider of this._itemsProviders.values()) {
                this._onDidChangeItemsProviders.fire(provider);
            }
            for (const { contribution } of this._contributions.values()) {
                this._onDidChangeSessionItems.fire(contribution.type);
            }
        }
    }
    _enableContribution(contribution, ext) {
        const disposableStore = new DisposableStore();
        this._contributionDisposables.set(contribution.type, disposableStore);
        disposableStore.add(this._registerAgent(contribution, ext));
        disposableStore.add(this._registerCommands(contribution));
        disposableStore.add(this._registerMenuItems(contribution, ext));
    }
    _disposeSessionsForContribution(contributionId) {
        // Find and dispose all sessions that belong to this contribution
        const sessionsToDispose = [];
        for (const [sessionResource, sessionData] of this._sessions) {
            if (sessionData.chatSessionType === contributionId) {
                sessionsToDispose.push(sessionResource);
            }
        }
        if (sessionsToDispose.length > 0) {
            this._logService.info(`Disposing ${sessionsToDispose.length} cached sessions for contribution '${contributionId}' due to when clause change`);
        }
        for (const sessionKey of sessionsToDispose) {
            const sessionData = this._sessions.get(sessionKey);
            if (sessionData) {
                sessionData.dispose(); // This will call _onWillDisposeSession and clean up
            }
        }
    }
    _registerAgent(contribution, ext) {
        const { type: id, name, displayName, description } = contribution;
        const agentData = {
            id,
            name,
            fullName: displayName,
            description: description,
            isDefault: false,
            isCore: false,
            isDynamic: true,
            slashCommands: contribution.commands ?? [],
            locations: [ChatAgentLocation.Chat],
            modes: [ChatModeKind.Agent, ChatModeKind.Ask],
            disambiguation: [],
            metadata: {
                themeIcon: Codicon.sendToRemoteAgent,
                isSticky: false,
            },
            capabilities: contribution.capabilities,
            canAccessPreviousChatHistory: true,
            extensionId: ext.identifier,
            extensionVersion: ext.version,
            extensionDisplayName: ext.displayName || ext.name,
            extensionPublisherId: ext.publisher,
        };
        return this._chatAgentService.registerAgent(id, agentData);
    }
    getAllChatSessionContributions() {
        return Array.from(this._contributions.values(), x => x.contribution)
            .filter(contribution => this._isContributionAvailable(contribution));
    }
    getAllChatSessionItemProviders() {
        return [...this._itemsProviders.values()].filter(provider => {
            // Check if the provider's corresponding contribution is available
            const contribution = this._contributions.get(provider.chatSessionType)?.contribution;
            return !contribution || this._isContributionAvailable(contribution);
        });
    }
    async activateChatSessionItemProvider(chatViewType) {
        await this._extensionService.whenInstalledExtensionsRegistered();
        const resolvedType = this._resolveToPrimaryType(chatViewType);
        if (resolvedType) {
            chatViewType = resolvedType;
        }
        const contribution = this._contributions.get(chatViewType)?.contribution;
        if (contribution && !this._isContributionAvailable(contribution)) {
            return undefined;
        }
        if (this._itemsProviders.has(chatViewType)) {
            return this._itemsProviders.get(chatViewType);
        }
        await this._extensionService.activateByEvent(`onChatSession:${chatViewType}`);
        return this._itemsProviders.get(chatViewType);
    }
    async canResolveChatSession(chatSessionResource) {
        await this._extensionService.whenInstalledExtensionsRegistered();
        const resolvedType = this._resolveToPrimaryType(chatSessionResource.scheme) || chatSessionResource.scheme;
        const contribution = this._contributions.get(resolvedType)?.contribution;
        if (contribution && !this._isContributionAvailable(contribution)) {
            return false;
        }
        if (this._contentProviders.has(chatSessionResource.scheme)) {
            return true;
        }
        await this._extensionService.activateByEvent(`onChatSession:${chatSessionResource.scheme}`);
        return this._contentProviders.has(chatSessionResource.scheme);
    }
    async getAllChatSessionItems(token) {
        return Promise.all(Array.from(this.getAllChatSessionContributions(), async (contrib) => {
            return {
                chatSessionType: contrib.type,
                items: await this.getChatSessionItems(contrib.type, token)
            };
        }));
    }
    async getChatSessionItems(chatSessionType, token) {
        if (!(await this.activateChatSessionItemProvider(chatSessionType))) {
            return [];
        }
        const resolvedType = this._resolveToPrimaryType(chatSessionType);
        if (resolvedType) {
            chatSessionType = resolvedType;
        }
        const provider = this._itemsProviders.get(chatSessionType);
        if (provider?.provideChatSessionItems) {
            const sessions = await provider.provideChatSessionItems(token);
            return sessions;
        }
        return [];
    }
    registerChatSessionItemProvider(provider) {
        const chatSessionType = provider.chatSessionType;
        this._itemsProviders.set(chatSessionType, provider);
        this._onDidChangeItemsProviders.fire(provider);
        const disposables = new DisposableStore();
        disposables.add(provider.onDidChangeChatSessionItems(() => {
            this._onDidChangeSessionItems.fire(chatSessionType);
        }));
        this.updateInProgressStatus(chatSessionType).catch(error => {
            this._logService.warn(`Failed to update initial progress status for '${chatSessionType}':`, error);
        });
        return {
            dispose: () => {
                disposables.dispose();
                const provider = this._itemsProviders.get(chatSessionType);
                if (provider) {
                    this._itemsProviders.delete(chatSessionType);
                    this._onDidChangeItemsProviders.fire(provider);
                }
            }
        };
    }
    registerChatSessionContentProvider(chatSessionType, provider) {
        if (this._contentProviders.has(chatSessionType)) {
            throw new Error(`Content provider for ${chatSessionType} is already registered.`);
        }
        this._contentProviders.set(chatSessionType, provider);
        this._onDidChangeContentProviderSchemes.fire({ added: [chatSessionType], removed: [] });
        return {
            dispose: () => {
                this._contentProviders.delete(chatSessionType);
                this._onDidChangeContentProviderSchemes.fire({ added: [], removed: [chatSessionType] });
                // Remove all sessions that were created by this provider
                for (const [key, session] of this._sessions) {
                    if (session.chatSessionType === chatSessionType) {
                        session.dispose();
                        this._sessions.delete(key);
                    }
                }
            }
        };
    }
    registerModelProgressListener(model, callback) {
        // Prevent duplicate registrations for the same model
        if (this._registeredModels.has(model)) {
            return;
        }
        this._registeredModels.add(model);
        // Helper function to register listeners for a request
        const registerRequestListeners = (request) => {
            if (!request.response || this._registeredRequestIds.has(request.id)) {
                return;
            }
            this._registeredRequestIds.add(request.id);
            this._register(request.response.onDidChange(() => {
                callback();
            }));
            // Track tool invocation state changes
            const responseParts = request.response.response.value;
            responseParts.forEach((part) => {
                if (part.kind === 'toolInvocation') {
                    const toolInvocation = part;
                    // Use autorun to listen for state changes
                    this._register(autorunSelfDisposable(reader => {
                        const state = toolInvocation.state.read(reader);
                        // Also track progress changes when executing
                        if (state.type === 1 /* IChatToolInvocation.StateKind.Executing */) {
                            state.progress.read(reader);
                        }
                        callback();
                    }));
                }
            });
        };
        // Listen for response changes on all existing requests
        const requests = model.getRequests();
        requests.forEach(registerRequestListeners);
        // Listen for new requests being added
        this._register(model.onDidChange(() => {
            const currentRequests = model.getRequests();
            currentRequests.forEach(registerRequestListeners);
        }));
        // Clean up when model is disposed
        this._register(model.onDidDispose(() => {
            this._registeredModels.delete(model);
        }));
    }
    getSessionDescription(chatModel) {
        const requests = chatModel.getRequests();
        if (requests.length === 0) {
            return undefined;
        }
        // Get the last request to check its response status
        const lastRequest = requests.at(-1);
        const response = lastRequest?.response;
        if (!response) {
            return undefined;
        }
        // If the response is complete, show Finished
        if (response.isComplete) {
            return undefined;
        }
        // Get the response parts to find tool invocations and progress messages
        const responseParts = response.response.value;
        let description = '';
        for (let i = responseParts.length - 1; i >= 0; i--) {
            const part = responseParts[i];
            if (!description && part.kind === 'toolInvocation') {
                const toolInvocation = part;
                const state = toolInvocation.state.get();
                if (state.type !== 3 /* IChatToolInvocation.StateKind.Completed */) {
                    const pastTenseMessage = toolInvocation.pastTenseMessage;
                    const invocationMessage = toolInvocation.invocationMessage;
                    const message = pastTenseMessage || invocationMessage;
                    description = typeof message === 'string' ? message : message?.value ?? '';
                    if (description) {
                        description = this.extractFileNameFromLink(description);
                    }
                    if (state.type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */) {
                        const message = toolInvocation.confirmationMessages?.title && (typeof toolInvocation.confirmationMessages.title === 'string'
                            ? toolInvocation.confirmationMessages.title
                            : toolInvocation.confirmationMessages.title.value);
                        description = message ?? localize('chat.sessions.description.waitingForConfirmation', "Waiting for confirmation: {0}", description);
                    }
                }
            }
            if (!description && part.kind === 'toolInvocationSerialized') {
                description = typeof part.invocationMessage === 'string' ? part.invocationMessage : part.invocationMessage?.value || '';
            }
            if (!description && part.kind === 'progressMessage') {
                description = part.content.value || '';
            }
        }
        return description || localize('chat.sessions.description.working', "Working...");
    }
    extractFileNameFromLink(filePath) {
        return filePath.replace(/\[(?<linkText>[^\]]*)\]\(file:\/\/\/(?<path>[^)]+)\)/g, (match, _p1, _p2, _offset, _string, groups) => {
            const fileName = groups?.path?.split('/').pop() || groups?.path || '';
            return (groups?.linkText?.trim() || fileName);
        });
    }
    /**
     * Creates a new chat session by delegating to the appropriate provider
     * @param chatSessionType The type of chat session provider to use
     * @param options Options for the new session including the request
     * @param token A cancellation token
     * @returns A session ID for the newly created session
     */
    async getNewChatSessionItem(chatSessionType, options, token) {
        if (!(await this.activateChatSessionItemProvider(chatSessionType))) {
            throw Error(`Cannot find provider for ${chatSessionType}`);
        }
        const resolvedType = this._resolveToPrimaryType(chatSessionType);
        if (resolvedType) {
            chatSessionType = resolvedType;
        }
        const provider = this._itemsProviders.get(chatSessionType);
        if (!provider?.provideNewChatSessionItem) {
            throw Error(`Provider for ${chatSessionType} does not support creating sessions`);
        }
        const chatSessionItem = await provider.provideNewChatSessionItem(options, token);
        this._onDidChangeSessionItems.fire(chatSessionType);
        return chatSessionItem;
    }
    async getOrCreateChatSession(sessionResource, token) {
        const existingSessionData = this._sessions.get(sessionResource);
        if (existingSessionData) {
            return existingSessionData.session;
        }
        if (!(await raceCancellationError(this.canResolveChatSession(sessionResource), token))) {
            throw Error(`Can not find provider for ${sessionResource}`);
        }
        const resolvedType = this._resolveToPrimaryType(sessionResource.scheme) || sessionResource.scheme;
        const provider = this._contentProviders.get(resolvedType);
        if (!provider) {
            throw Error(`Can not find provider for ${sessionResource}`);
        }
        const session = await raceCancellationError(provider.provideChatSessionContent(sessionResource, token), token);
        const sessionData = new ContributedChatSessionData(session, sessionResource.scheme, sessionResource, session.options, resource => {
            sessionData.dispose();
            this._sessions.delete(resource);
        });
        this._sessions.set(sessionResource, sessionData);
        return session;
    }
    hasAnySessionOptions(sessionResource) {
        const session = this._sessions.get(sessionResource);
        return !!session && !!session.options && Object.keys(session.options).length > 0;
    }
    getSessionOption(sessionResource, optionId) {
        const session = this._sessions.get(sessionResource);
        return session?.getOption(optionId);
    }
    setSessionOption(sessionResource, optionId, value) {
        const session = this._sessions.get(sessionResource);
        return !!session?.setOption(optionId, value);
    }
    // Implementation of editable session methods
    async setEditableSession(sessionResource, data) {
        if (!data) {
            this._editableSessions.delete(sessionResource);
        }
        else {
            this._editableSessions.set(sessionResource, data);
        }
        // Trigger refresh of the session views that might need to update their rendering
        this._onDidChangeSessionItems.fire(localChatSessionType);
    }
    getEditableData(sessionResource) {
        return this._editableSessions.get(sessionResource);
    }
    isEditable(sessionResource) {
        return this._editableSessions.has(sessionResource);
    }
    notifySessionItemsChanged(chatSessionType) {
        this._onDidChangeSessionItems.fire(chatSessionType);
    }
    /**
     * Store option groups for a session type
     */
    setOptionGroupsForSessionType(chatSessionType, handle, optionGroups) {
        if (optionGroups) {
            this._sessionTypeOptions.set(chatSessionType, optionGroups);
        }
        else {
            this._sessionTypeOptions.delete(chatSessionType);
        }
    }
    /**
     * Get available option groups for a session type
     */
    getOptionGroupsForSessionType(chatSessionType) {
        return this._sessionTypeOptions.get(chatSessionType);
    }
    /**
     * Set the callback for notifying extensions about option changes
     */
    setOptionsChangeCallback(callback) {
        this._optionsChangeCallback = callback;
    }
    /**
     * Notify extension about option changes for a session
     */
    async notifySessionOptionsChange(sessionResource, updates) {
        if (!updates.length) {
            return;
        }
        if (this._optionsChangeCallback) {
            await this._optionsChangeCallback(sessionResource, updates);
        }
        for (const u of updates) {
            this.setSessionOption(sessionResource, u.optionId, u.value);
        }
    }
    /**
     * Get the icon for a specific session type
     */
    getIconForSessionType(chatSessionType) {
        const sessionTypeIcon = this._sessionTypeIcons.get(chatSessionType);
        if (ThemeIcon.isThemeIcon(sessionTypeIcon)) {
            return sessionTypeIcon;
        }
        if (isDark(this._themeService.getColorTheme().type)) {
            return sessionTypeIcon?.dark;
        }
        else {
            return sessionTypeIcon?.light;
        }
    }
    /**
     * Get the welcome title for a specific session type
     */
    getWelcomeTitleForSessionType(chatSessionType) {
        return this._sessionTypeWelcomeTitles.get(chatSessionType);
    }
    /**
     * Get the welcome message for a specific session type
     */
    getWelcomeMessageForSessionType(chatSessionType) {
        return this._sessionTypeWelcomeMessages.get(chatSessionType);
    }
    /**
     * Get the input placeholder for a specific session type
     */
    getInputPlaceholderForSessionType(chatSessionType) {
        return this._sessionTypeInputPlaceholders.get(chatSessionType);
    }
    /**
     * Get the capabilities for a specific session type
     */
    getCapabilitiesForSessionType(chatSessionType) {
        const contribution = this._contributions.get(chatSessionType)?.contribution;
        return contribution?.capabilities;
    }
    getContentProviderSchemes() {
        return Array.from(this._contentProviders.keys());
    }
};
ChatSessionsService = __decorate([
    __param(0, ILogService),
    __param(1, IChatAgentService),
    __param(2, IExtensionService),
    __param(3, IContextKeyService),
    __param(4, IMenuService),
    __param(5, IThemeService),
    __param(6, ILabelService)
], ChatSessionsService);
export { ChatSessionsService };
registerSingleton(IChatSessionsService, ChatSessionsService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlc3Npb25zLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNlc3Npb25zLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDL0csT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEtBQUssU0FBUyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0s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