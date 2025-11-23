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
import { localize, localize2 } from '../../../../../nls.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { AbstractGotoLineQuickAccessProvider } from '../../../../../editor/contrib/quickAccess/browser/gotoLineQuickAccess.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as QuickAccessExtensions } from '../../../../../platform/quickinput/common/quickAccess.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
let GotoLineQuickAccessProvider = class GotoLineQuickAccessProvider extends AbstractGotoLineQuickAccessProvider {
    constructor(editorService, editorGroupService, configurationService, storageService) {
        super();
        this.editorService = editorService;
        this.editorGroupService = editorGroupService;
        this.configurationService = configurationService;
        this.storageService = storageService;
        this.onDidActiveTextEditorControlChange = this.editorService.onDidActiveEditorChange;
    }
    get configuration() {
        const editorConfig = this.configurationService.getValue().workbench?.editor;
        return {
            openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview
        };
    }
    get activeTextEditorControl() {
        return this.editorService.activeTextEditorControl;
    }
    gotoLocation(context, options) {
        // Check for sideBySide use
        if ((options.keyMods.alt || (this.configuration.openEditorPinned && options.keyMods.ctrlCmd) || options.forceSideBySide) && this.editorService.activeEditor) {
            context.restoreViewState?.(); // since we open to the side, restore view state in this editor
            const editorOptions = {
                selection: options.range,
                pinned: options.keyMods.ctrlCmd || this.configuration.openEditorPinned,
                preserveFocus: options.preserveFocus
            };
            this.editorGroupService.sideGroup.openEditor(this.editorService.activeEditor, editorOptions);
        }
        // Otherwise let parent handle it
        else {
            super.gotoLocation(context, options);
        }
    }
};
GotoLineQuickAccessProvider = __decorate([
    __param(0, IEditorService),
    __param(1, IEditorGroupsService),
    __param(2, IConfigurationService),
    __param(3, IStorageService)
], GotoLineQuickAccessProvider);
export { GotoLineQuickAccessProvider };
class GotoLineAction extends Action2 {
    static { this.ID = 'workbench.action.gotoLine'; }
    constructor() {
        super({
            id: GotoLineAction.ID,
            title: localize2('gotoLine', 'Go to Line/Column...'),
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: null,
                primary: 2048 /* KeyMod.CtrlCmd */ | 37 /* KeyCode.KeyG */,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 37 /* KeyCode.KeyG */ }
            }
        });
    }
    async run(accessor) {
        accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_LINE_PREFIX);
    }
}
registerAction2(GotoLineAction);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
    ctor: GotoLineQuickAccessProvider,
    prefix: AbstractGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX,
    placeholder: localize('gotoLineQuickAccessPlaceholder', "Type the line number and optional column to go to (e.g. :42:5 for line 42, column 5). Type :: to go to a character offset (e.g. ::1024 for character 1024 from the start of the file). Use negative values to navigate backwards."),
    helpEntries: [{ description: localize('gotoLineQuickAccess', "Go to Line/Column"), commandId: GotoLineAction.ID }]
});
class GotoOffsetAction extends Action2 {
    static { this.ID = 'workbench.action.gotoOffset'; }
    constructor() {
        super({
            id: GotoOffsetAction.ID,
            title: localize2('gotoOffset', 'Go to Offset...'),
            f1: true
        });
    }
    async run(accessor) {
        accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX);
    }
}
registerAction2(GotoOffsetAction);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
    ctor: GotoLineQuickAccessProvider,
    prefix: GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX,
    placeholder: localize('gotoLineQuickAccessPlaceholder', "Type the line number and optional column to go to (e.g. :42:5 for line 42, column 5). Type :: to go to a character offset (e.g. ::1024 for character 1024 from the start of the file). Use negative values to navigate backwards."),
    helpEntries: [{ description: localize('gotoOffsetQuickAccess', "Go to Offset"), commandId: GotoOffsetAction.ID }]
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ290b0xpbmVRdWlja0FjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvcXVpY2thY2Nlc3MvZ290b0xpbmVRdWlja0FjY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBWSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUVyRixPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSwwRUFBMEUsQ0FBQztBQUMvSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDL0UsT0FBTyxFQUF3QixVQUFVLElBQUkscUJBQXFCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNySSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBTTdGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUU3RSxJQUFNLDJCQUEyQixHQUFqQyxNQUFNLDJCQUE0QixTQUFRLG1DQUFtQztJQUluRixZQUNrQyxhQUE2QixFQUN2QixrQkFBd0MsRUFDdkMsb0JBQTJDLEVBQ3RDLGNBQStCO1FBRTVFLEtBQUssRUFBRSxDQUFDO1FBTHlCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUN2Qix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXNCO1FBQ3ZDLHlCQUFvQixHQUFw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