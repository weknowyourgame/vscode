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
import { AbstractGotoLineQuickAccessProvider } from '../../../contrib/quickAccess/browser/gotoLineQuickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { ICodeEditorService } from '../../../browser/services/codeEditorService.js';
import { GoToLineNLS } from '../../../common/standaloneStrings.js';
import { Event } from '../../../../base/common/event.js';
import { EditorAction, registerEditorAction } from '../../../browser/editorExtensions.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
let StandaloneGotoLineQuickAccessProvider = class StandaloneGotoLineQuickAccessProvider extends AbstractGotoLineQuickAccessProvider {
    constructor(editorService, storageService) {
        super();
        this.editorService = editorService;
        this.storageService = storageService;
        this.onDidActiveTextEditorControlChange = Event.None;
    }
    get activeTextEditorControl() {
        return this.editorService.getFocusedCodeEditor() ?? undefined;
    }
};
StandaloneGotoLineQuickAccessProvider = __decorate([
    __param(0, ICodeEditorService),
    __param(1, IStorageService)
], StandaloneGotoLineQuickAccessProvider);
export { StandaloneGotoLineQuickAccessProvider };
export class GotoLineAction extends EditorAction {
    static { this.ID = 'editor.action.gotoLine'; }
    constructor() {
        super({
            id: GotoLineAction.ID,
            label: GoToLineNLS.gotoLineActionLabel,
            alias: 'Go to Line/Column...',
            precondition: undefined,
            kbOpts: {
                kbExpr: EditorContextKeys.focus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 37 /* KeyCode.KeyG */,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 37 /* KeyCode.KeyG */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    run(accessor) {
        accessor.get(IQuickInputService).quickAccess.show(StandaloneGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX);
    }
}
registerEditorAction(GotoLineAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
    ctor: StandaloneGotoLineQuickAccessProvider,
    prefix: StandaloneGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX,
    helpEntries: [{ description: GoToLineNLS.gotoLineActionLabel, commandId: GotoLineAction.ID }]
});
class GotoOffsetAction extends EditorAction {
    static { this.ID = 'editor.action.gotoOffset'; }
    constructor() {
        super({
            id: GotoOffsetAction.ID,
            label: GoToLineNLS.gotoOffsetActionLabel,
            alias: 'Go to Offset...',
            precondition: undefined,
        });
    }
    run(accessor) {
        accessor.get(IQuickInputService).quickAccess.show(StandaloneGotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX);
    }
}
registerEditorAction(GotoOffsetAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
    ctor: StandaloneGotoLineQuickAccessProvider,
    prefix: StandaloneGotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX,
    helpEntries: [{ description: GoToLineNLS.gotoOffsetActionLabel, commandId: GotoOffsetAction.ID }]
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhbG9uZUdvdG9MaW5lUXVpY2tBY2Nlc3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3N0YW5kYWxvbmUvYnJvd3Nlci9xdWlja0FjY2Vzcy9zdGFuZGFsb25lR290b0xpbmVRdWlja0FjY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUF3QixVQUFVLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxZQUFZLEVBQUUsb0JBQW9CLEVBQW9CLE1BQU0sc0NBQXNDLENBQUM7QUFDNUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHekUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRTFFLElBQU0scUNBQXFDLEdBQTNDLE1BQU0scUNBQXNDLFNBQVEsbUNBQW1DO0lBSTdGLFlBQ3FCLGFBQWtELEVBQ3JELGNBQTJEO1FBRTVFLEtBQUssRUFBRSxDQUFDO1FBSDZCLGtCQUFhLEdBQWIsYUFBYSxDQUFvQjtRQUN6QixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFKMUQsdUNBQWtDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztJQU9uRSxDQUFDO0lBRUQsSUFB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