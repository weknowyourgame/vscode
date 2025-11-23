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
var AbstractTextEditor_1;
import { localize } from '../../../../nls.js';
import { distinct, deepClone } from '../../../../base/common/objects.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { isObject, assertReturnsDefined } from '../../../../base/common/types.js';
import { MutableDisposable } from '../../../../base/common/lifecycle.js';
import { computeEditorAriaLabel } from '../../editor.js';
import { AbstractEditorWithViewState } from './editorWithViewState.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
/**
 * The base class of editors that leverage any kind of text editor for the editing experience.
 */
let AbstractTextEditor = class AbstractTextEditor extends AbstractEditorWithViewState {
    static { AbstractTextEditor_1 = this; }
    static { this.VIEW_STATE_PREFERENCE_KEY = 'textEditorViewState'; }
    constructor(id, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, fileService) {
        super(id, group, AbstractTextEditor_1.VIEW_STATE_PREFERENCE_KEY, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService);
        this.fileService = fileService;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        this._onDidChangeScroll = this._register(new Emitter());
        this.onDidChangeScroll = this._onDidChangeScroll.event;
        this.inputListener = this._register(new MutableDisposable());
        // Listen to configuration changes
        this._register(this.textResourceConfigurationService.onDidChangeConfiguration(e => this.handleConfigurationChangeEvent(e)));
        // ARIA: if a group is added or removed, update the editor's ARIA
        // label so that it appears in the label for when there are > 1 groups
        this._register(Event.any(this.editorGroupService.onDidAddGroup, this.editorGroupService.onDidRemoveGroup)(() => {
            const ariaLabel = this.computeAriaLabel();
            this.editorContainer?.setAttribute('aria-label', ariaLabel);
            this.updateEditorControlOptions({ ariaLabel });
        }));
        // Listen to file system provider changes
        this._register(this.fileService.onDidChangeFileSystemProviderCapabilities(e => this.onDidChangeFileSystemProvider(e.scheme)));
        this._register(this.fileService.onDidChangeFileSystemProviderRegistrations(e => this.onDidChangeFileSystemProvider(e.scheme)));
    }
    handleConfigurationChangeEvent(e) {
        const resource = this.getActiveResource();
        if (!this.shouldHandleConfigurationChangeEvent(e, resource)) {
            return;
        }
        if (this.isVisible()) {
            this.updateEditorConfiguration(resource);
        }
        else {
            this.hasPendingConfigurationChange = true;
        }
    }
    shouldHandleConfigurationChangeEvent(e, resource) {
        return e.affectsConfiguration(resource, 'editor') || e.affectsConfiguration(resource, 'problems.visibility');
    }
    consumePendingConfigurationChangeEvent() {
        if (this.hasPendingConfigurationChange) {
            this.updateEditorConfiguration();
            this.hasPendingConfigurationChange = false;
        }
    }
    computeConfiguration(configuration) {
        // Specific editor options always overwrite user configuration
        const editorConfiguration = isObject(configuration.editor) ? deepClone(configuration.editor) : Object.create(null);
        Object.assign(editorConfiguration, this.getConfigurationOverrides(configuration));
        // ARIA label
        editorConfiguration.ariaLabel = this.computeAriaLabel();
        return editorConfiguration;
    }
    computeAriaLabel() {
        return this.input ? computeEditorAriaLabel(this.input, undefined, this.group, this.editorGroupService.count) : localize('editor', "Editor");
    }
    onDidChangeFileSystemProvider(scheme) {
        if (!this.input) {
            return;
        }
        if (this.getActiveResource()?.scheme === scheme) {
            this.updateReadonly(this.input);
        }
    }
    onDidChangeInputCapabilities(input) {
        if (this.input === input) {
            this.updateReadonly(input);
        }
    }
    updateReadonly(input) {
        this.updateEditorControlOptions({ ...this.getReadonlyConfiguration(input.isReadonly()) });
    }
    getReadonlyConfiguration(isReadonly) {
        return {
            readOnly: !!isReadonly,
            readOnlyMessage: typeof isReadonly !== 'boolean' ? isReadonly : undefined
        };
    }
    getConfigurationOverrides(configuration) {
        return {
            overviewRulerLanes: 3,
            lineNumbersMinChars: 3,
            fixedOverflowWidgets: true,
            ...this.getReadonlyConfiguration(this.input?.isReadonly()),
            renderValidationDecorations: configuration.problems?.visibility !== false ? 'on' : 'off'
        };
    }
    createEditor(parent) {
        // Create editor control
        this.editorContainer = parent;
        this.createEditorControl(parent, this.computeConfiguration(this.textResourceConfigurationService.getValue(this.getActiveResource())));
        // Listeners
        this.registerCodeEditorListeners();
    }
    registerCodeEditorListeners() {
        const mainControl = this.getMainControl();
        if (mainControl) {
            this._register(mainControl.onDidChangeModelLanguage(() => this.updateEditorConfiguration()));
            this._register(mainControl.onDidChangeModel(() => this.updateEditorConfiguration()));
            this._register(mainControl.onDidChangeCursorPosition(e => this._onDidChangeSelection.fire({ reason: this.toEditorPaneSelectionChangeReason(e) })));
            this._register(mainControl.onDidChangeModelContent(() => this._onDidChangeSelection.fire({ reason: 3 /* EditorPaneSelectionChangeReason.EDIT */ })));
            this._register(mainControl.onDidScrollChange(() => this._onDidChangeScroll.fire()));
        }
    }
    toEditorPaneSelectionChangeReason(e) {
        switch (e.source) {
            case "api" /* TextEditorSelectionSource.PROGRAMMATIC */: return 1 /* EditorPaneSelectionChangeReason.PROGRAMMATIC */;
            case "code.navigation" /* TextEditorSelectionSource.NAVIGATION */: return 4 /* EditorPaneSelectionChangeReason.NAVIGATION */;
            case "code.jump" /* TextEditorSelectionSource.JUMP */: return 5 /* EditorPaneSelectionChangeReason.JUMP */;
            default: return 2 /* EditorPaneSelectionChangeReason.USER */;
        }
    }
    getSelection() {
        const mainControl = this.getMainControl();
        if (mainControl) {
            const selection = mainControl.getSelection();
            if (selection) {
                return new TextEditorPaneSelection(selection);
            }
        }
        return undefined;
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        // Update our listener for input capabilities
        this.inputListener.value = input.onDidChangeCapabilities(() => this.onDidChangeInputCapabilities(input));
        // Update editor options after having set the input. We do this because there can be
        // editor input specific options (e.g. an ARIA label depending on the input showing)
        this.updateEditorConfiguration();
        // Update aria label on editor
        const editorContainer = assertReturnsDefined(this.editorContainer);
        editorContainer.setAttribute('aria-label', this.computeAriaLabel());
    }
    clearInput() {
        // Clear input listener
        this.inputListener.clear();
        super.clearInput();
    }
    getScrollPosition() {
        const editor = this.getMainControl();
        if (!editor) {
            throw new Error('Control has not yet been initialized');
        }
        return {
            // The top position can vary depending on the view zones (find widget for example)
            scrollTop: editor.getScrollTop() - editor.getTopForLineNumber(1),
            scrollLeft: editor.getScrollLeft(),
        };
    }
    setScrollPosition(scrollPosition) {
        const editor = this.getMainControl();
        if (!editor) {
            throw new Error('Control has not yet been initialized');
        }
        editor.setScrollTop(scrollPosition.scrollTop);
        if (scrollPosition.scrollLeft) {
            editor.setScrollLeft(scrollPosition.scrollLeft);
        }
    }
    setEditorVisible(visible) {
        if (visible) {
            this.consumePendingConfigurationChangeEvent();
        }
        super.setEditorVisible(visible);
    }
    toEditorViewStateResource(input) {
        return input.resource;
    }
    updateEditorConfiguration(resource = this.getActiveResource()) {
        let configuration = undefined;
        if (resource) {
            configuration = this.textResourceConfigurationService.getValue(resource);
        }
        if (!configuration) {
            return;
        }
        const editorConfiguration = this.computeConfiguration(configuration);
        // Try to figure out the actual editor options that changed from the last time we updated the editor.
        // We do this so that we are not overwriting some dynamic editor settings (e.g. word wrap) that might
        // have been applied to the editor directly.
        let editorSettingsToApply = editorConfiguration;
        if (this.lastAppliedEditorOptions) {
            editorSettingsToApply = distinct(this.lastAppliedEditorOptions, editorSettingsToApply);
        }
        if (Object.keys(editorSettingsToApply).length > 0) {
            this.lastAppliedEditorOptions = editorConfiguration;
            this.updateEditorControlOptions(editorSettingsToApply);
        }
    }
    getActiveResource() {
        const mainControl = this.getMainControl();
        if (mainControl) {
            const model = mainControl.getModel();
            if (model) {
                return model.uri;
            }
        }
        if (this.input) {
            return this.input.resource;
        }
        return undefined;
    }
    dispose() {
        this.lastAppliedEditorOptions = undefined;
        super.dispose();
    }
};
AbstractTextEditor = AbstractTextEditor_1 = __decorate([
    __param(2, ITelemetryService),
    __param(3, IInstantiationService),
    __param(4, IStorageService),
    __param(5, ITextResourceConfigurationService),
    __param(6, IThemeService),
    __param(7, IEditorService),
    __param(8, IEditorGroupsService),
    __param(9, IFileService)
], AbstractTextEditor);
export { AbstractTextEditor };
export class TextEditorPaneSelection {
    static { this.TEXT_EDITOR_SELECTION_THRESHOLD = 10; } // number of lines to move in editor to justify for significant change
    constructor(textSelection) {
        this.textSelection = textSelection;
    }
    compare(other) {
        if (!(other instanceof TextEditorPaneSelection)) {
            return 3 /* EditorPaneSelectionCompareResult.DIFFERENT */;
        }
        const thisLineNumber = Math.min(this.textSelection.selectionStartLineNumber, this.textSelection.positionLineNumber);
        const otherLineNumber = Math.min(other.textSelection.selectionStartLineNumber, other.textSelection.positionLineNumber);
        if (thisLineNumber === otherLineNumber) {
            return 1 /* EditorPaneSelectionCompareResult.IDENTICAL */;
        }
        if (Math.abs(thisLineNumber - otherLineNumber) < TextEditorPaneSelection.TEXT_EDITOR_SELECTION_THRESHOLD) {
            return 2 /* EditorPaneSelectionCompareResult.SIMILAR */; // when in close proximity, treat selection as being similar
        }
        return 3 /* EditorPaneSelectionCompareResult.DIFFERENT */;
    }
    restore(options) {
        const textEditorOptions = {
            ...options,
            selection: this.textSelection,
            selectionRevealType: 1 /* TextEditorSelectionRevealType.CenterIfOutsideViewport */
        };
        return textEditorOptions;
    }
    log() {
        return `line: ${this.textSelection.startLineNumber}-${this.textSelection.endLineNumber}, col:  ${this.textSelection.startColumn}-${this.textSelection.endColumn}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvdGV4dEVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRTlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFJekUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDekQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHdkUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQXlDLGlDQUFpQyxFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFFM0osT0FBTyxFQUFnQixvQkFBb0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBRTVHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUdsRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFnQjFFOztHQUVHO0FB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