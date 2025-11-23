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
import { h } from '../../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { autorun, derived, observableFromEvent } from '../../../../../../base/common/observable.js';
import { EditorExtensionsRegistry } from '../../../../../../editor/browser/editorExtensions.js';
import { CodeEditorWidget } from '../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { Selection } from '../../../../../../editor/common/core/selection.js';
import { CodeLensContribution } from '../../../../../../editor/contrib/codelens/browser/codelensController.js';
import { FoldingController } from '../../../../../../editor/contrib/folding/browser/folding.js';
import { MenuWorkbenchToolBar } from '../../../../../../platform/actions/browser/toolbar.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { DEFAULT_EDITOR_MAX_DIMENSIONS, DEFAULT_EDITOR_MIN_DIMENSIONS } from '../../../../../browser/parts/editor/editor.js';
import { setStyle } from '../../utils.js';
import { observableConfigValue } from '../../../../../../platform/observable/common/platformObservableUtils.js';
export class CodeEditorView extends Disposable {
    updateOptions(newOptions) {
        this.editor.updateOptions(newOptions);
    }
    constructor(instantiationService, viewModel, configurationService) {
        super();
        this.instantiationService = instantiationService;
        this.viewModel = viewModel;
        this.configurationService = configurationService;
        this.model = this.viewModel.map(m => /** @description model */ m?.model);
        this.htmlElements = h('div.code-view', [
            h('div.header@header', [
                h('span.title@title'),
                h('span.description@description'),
                h('span.detail@detail'),
                h('span.toolbar@toolbar'),
            ]),
            h('div.container', [
                h('div.gutter@gutterDiv'),
                h('div@editor'),
            ]),
        ]);
        this._onDidViewChange = new Emitter();
        this.view = {
            element: this.htmlElements.root,
            minimumWidth: DEFAULT_EDITOR_MIN_DIMENSIONS.width,
            maximumWidth: DEFAULT_EDITOR_MAX_DIMENSIONS.width,
            minimumHeight: DEFAULT_EDITOR_MIN_DIMENSIONS.height,
            maximumHeight: DEFAULT_EDITOR_MAX_DIMENSIONS.height,
            onDidChange: this._onDidViewChange.event,
            layout: (width, height, top, left) => {
                setStyle(this.htmlElements.root, { width, height, top, left });
                this.editor.layout({
                    width: width - this.htmlElements.gutterDiv.clientWidth,
                    height: height - this.htmlElements.header.clientHeight,
                });
            }
            // preferredWidth?: number | undefined;
            // preferredHeight?: number | undefined;
            // priority?: LayoutPriority | undefined;
            // snap?: boolean | undefined;
        };
        this.checkboxesVisible = observableConfigValue('mergeEditor.showCheckboxes', false, this.configurationService);
        this.showDeletionMarkers = observableConfigValue('mergeEditor.showDeletionMarkers', true, this.configurationService);
        this.useSimplifiedDecorations = observableConfigValue('mergeEditor.useSimplifiedDecorations', false, this.configurationService);
        this.editor = this.instantiationService.createInstance(CodeEditorWidget, this.htmlElements.editor, {}, {
            contributions: this.getEditorContributions(),
        });
        this.isFocused = observableFromEvent(this, Event.any(this.editor.onDidBlurEditorWidget, this.editor.onDidFocusEditorWidget), () => /** @description editor.hasWidgetFocus */ this.editor.hasWidgetFocus());
        this.cursorPosition = observableFromEvent(this, this.editor.onDidChangeCursorPosition, () => /** @description editor.getPosition */ this.editor.getPosition());
        this.selection = observableFromEvent(this, this.editor.onDidChangeCursorSelection, () => /** @description editor.getSelections */ this.editor.getSelections());
        this.cursorLineNumber = this.cursorPosition.map(p => /** @description cursorPosition.lineNumber */ p?.lineNumber);
    }
    getEditorContributions() {
        return EditorExtensionsRegistry.getEditorContributions().filter(c => c.id !== FoldingController.ID && c.id !== CodeLensContribution.ID);
    }
}
export function createSelectionsAutorun(codeEditorView, translateRange) {
    const selections = derived(reader => {
        /** @description selections */
        const viewModel = codeEditorView.viewModel.read(reader);
        if (!viewModel) {
            return [];
        }
        const baseRange = viewModel.selectionInBase.read(reader);
        if (!baseRange || baseRange.sourceEditor === codeEditorView) {
            return [];
        }
        return baseRange.rangesInBase.map(r => translateRange(r, viewModel));
    });
    return autorun(reader => {
        /** @description set selections */
        const ranges = selections.read(reader);
        if (ranges.length === 0) {
            return;
        }
        codeEditorView.editor.setSelections(ranges.map(r => new Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)));
    });
}
let TitleMenu = class TitleMenu extends Disposable {
    constructor(menuId, targetHtmlElement, instantiationService) {
        super();
        const toolbar = instantiationService.createInstance(MenuWorkbenchToolBar, targetHtmlElement, menuId, {
            menuOptions: { renderShortTitle: true },
            toolbarOptions: { primaryGroup: (g) => g === 'primary' }
        });
        this._store.add(toolbar);
    }
};
TitleMenu = __decorate([
    __param(2, IInstantiationService)
], TitleMenu);
export { TitleMenu };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUVkaXRvclZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci92aWV3L2VkaXRvcnMvY29kZUVkaXRvclZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRTFELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3JGLE9BQU8sRUFBZSxPQUFPLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDakgsT0FBTyxFQUFFLHdCQUF3QixFQUFrQyxNQUFNLHNEQUFzRCxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBRzFHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM5RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUMvRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUc3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDMUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFHaEgsTUFBTSxPQUFnQixj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