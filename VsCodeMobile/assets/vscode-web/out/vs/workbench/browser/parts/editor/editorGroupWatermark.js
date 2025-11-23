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
var EditorGroupWatermark_1;
import { $, append, clearNode, h } from '../../../../base/browser/dom.js';
import { KeybindingLabel } from '../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { coalesce, shuffle } from '../../../../base/common/arrays.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb, OS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IStorageService, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
import { defaultKeybindingLabelStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { editorForeground, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
const showCommands = { text: localize('watermark.showCommands', "Show All Commands"), id: 'workbench.action.showCommands' };
const gotoFile = { text: localize('watermark.quickAccess', "Go to File"), id: 'workbench.action.quickOpen' };
const openFile = { text: localize('watermark.openFile', "Open File"), id: 'workbench.action.files.openFile' };
const openFolder = { text: localize('watermark.openFolder', "Open Folder"), id: 'workbench.action.files.openFolder' };
const openFileOrFolder = { text: localize('watermark.openFileFolder', "Open File or Folder"), id: 'workbench.action.files.openFileFolder' };
const openRecent = { text: localize('watermark.openRecent', "Open Recent"), id: 'workbench.action.openRecent' };
const newUntitledFile = { text: localize('watermark.newUntitledFile', "New Untitled Text File"), id: 'workbench.action.files.newUntitledFile' };
const findInFiles = { text: localize('watermark.findInFiles', "Find in Files"), id: 'workbench.action.findInFiles' };
const toggleTerminal = { text: localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: 'workbench.action.terminal.toggleTerminal', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const startDebugging = { text: localize('watermark.startDebugging', "Start Debugging"), id: 'workbench.action.debug.start', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const openSettings = { text: localize('watermark.openSettings', "Open Settings"), id: 'workbench.action.openSettings' };
const showChat = ContextKeyExpr.and(ContextKeyExpr.equals('chatSetupHidden', false), ContextKeyExpr.equals('chatSetupDisabled', false));
const openChat = { text: localize('watermark.openChat', "Open Chat"), id: 'workbench.action.chat.open', when: { native: showChat, web: showChat } };
const emptyWindowEntries = coalesce([
    showCommands,
    ...(isMacintosh && !isWeb ? [openFileOrFolder] : [openFile, openFolder]),
    openRecent,
    isMacintosh && !isWeb ? newUntitledFile : undefined, // fill in one more on macOS to get to 5 entries
    openChat
]);
const randomEmptyWindowEntries = [
/* Nothing yet */
];
const workspaceEntries = [
    showCommands,
    gotoFile,
    openChat
];
const randomWorkspaceEntries = [
    findInFiles,
    startDebugging,
    toggleTerminal,
    openSettings,
];
let EditorGroupWatermark = class EditorGroupWatermark extends Disposable {
    static { EditorGroupWatermark_1 = this; }
    static { this.CACHED_WHEN = 'editorGroupWatermark.whenConditions'; }
    constructor(container, keybindingService, contextService, contextKeyService, configurationService, storageService) {
        super();
        this.keybindingService = keybindingService;
        this.contextService = contextService;
        this.contextKeyService = contextKeyService;
        this.configurationService = configurationService;
        this.storageService = storageService;
        this.transientDisposables = this._register(new DisposableStore());
        this.keybindingLabels = this._register(new DisposableStore());
        this.enabled = false;
        this.cachedWhen = this.storageService.getObject(EditorGroupWatermark_1.CACHED_WHEN, 0 /* StorageScope.PROFILE */, Object.create(null));
        this.workbenchState = this.contextService.getWorkbenchState();
        const elements = h('.editor-group-watermark', [
            h('.letterpress'),
            h('.shortcuts@shortcuts'),
        ]);
        append(container, elements.root);
        this.shortcuts = elements.shortcuts;
        this.registerListeners();
        this.render();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('workbench.tips.enabled') && this.enabled !== this.configurationService.getValue('workbench.tips.enabled')) {
                this.render();
            }
        }));
        this._register(this.contextService.onDidChangeWorkbenchState(workbenchState => {
            if (this.workbenchState !== workbenchState) {
                this.workbenchState = workbenchState;
                this.render();
            }
        }));
        this._register(this.storageService.onWillSaveState(e => {
            if (e.reason === WillSaveStateReason.SHUTDOWN) {
                const entries = [...emptyWindowEntries, ...randomEmptyWindowEntries, ...workspaceEntries, ...randomWorkspaceEntries];
                for (const entry of entries) {
                    const when = isWeb ? entry.when?.web : entry.when?.native;
                    if (when) {
                        this.cachedWhen[entry.id] = this.contextKeyService.contextMatchesRules(when);
                    }
                }
                this.storageService.store(EditorGroupWatermark_1.CACHED_WHEN, JSON.stringify(this.cachedWhen), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
            }
        }));
    }
    render() {
        this.enabled = this.configurationService.getValue('workbench.tips.enabled');
        clearNode(this.shortcuts);
        this.transientDisposables.clear();
        if (!this.enabled) {
            return;
        }
        const fixedEntries = this.filterEntries(this.workbenchState !== 1 /* WorkbenchState.EMPTY */ ? workspaceEntries : emptyWindowEntries, false /* not shuffled */);
        const randomEntries = this.filterEntries(this.workbenchState !== 1 /* WorkbenchState.EMPTY */ ? randomWorkspaceEntries : randomEmptyWindowEntries, true /* shuffled */).slice(0, Math.max(0, 5 - fixedEntries.length));
        const entries = [...fixedEntries, ...randomEntries];
        const box = append(this.shortcuts, $('.watermark-box'));
        const update = () => {
            clearNode(box);
            this.keybindingLabels.clear();
            for (const entry of entries) {
                const keys = this.keybindingService.lookupKeybinding(entry.id);
                if (!keys) {
                    continue;
                }
                const dl = append(box, $('dl'));
                const dt = append(dl, $('dt'));
                dt.textContent = entry.text;
                const dd = append(dl, $('dd'));
                const label = this.keybindingLabels.add(new KeybindingLabel(dd, OS, { renderUnboundKeybindings: true, ...defaultKeybindingLabelStyles }));
                label.set(keys);
            }
        };
        update();
        this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(update));
    }
    filterEntries(entries, shuffleEntries) {
        const filteredEntries = entries
            .filter(entry => (isWeb && !entry.when?.web) || (!isWeb && !entry.when?.native) || this.cachedWhen[entry.id])
            .filter(entry => !!CommandsRegistry.getCommand(entry.id))
            .filter(entry => !!this.keybindingService.lookupKeybinding(entry.id));
        if (shuffleEntries) {
            shuffle(filteredEntries);
        }
        return filteredEntries;
    }
};
EditorGroupWatermark = EditorGroupWatermark_1 = __decorate([
    __param(1, IKeybindingService),
    __param(2, IWorkspaceContextService),
    __param(3, IContextKeyService),
    __param(4, IConfigurationService),
    __param(5, IStorageService)
], EditorGroupWatermark);
export { EditorGroupWatermark };
registerColor('editorWatermark.foreground', { dark: transparent(editorForeground, 0.6), light: transparent(editorForeground, 0.68), hcDark: editorForeground, hcLight: editorForeground }, localize('editorLineHighlight', 'Foreground color for the labels in the editor watermark.'));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yR3JvdXBXYXRlcm1hcmsuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckdyb3VwV2F0ZXJtYXJrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBd0Isa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNoSSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUErQixtQkFBbUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25JLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFD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