var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './output.css';
import * as nls from '../../../../nls.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { AbstractTextResourceEditor } from '../../../browser/parts/editor/textResourceEditor.js';
import { OUTPUT_VIEW_ID, CONTEXT_IN_OUTPUT, CONTEXT_OUTPUT_SCROLL_LOCK, IOutputService, OUTPUT_FILTER_FOCUS_CONTEXT, HIDE_CATEGORY_FILTER_CONTEXT } from '../../../services/output/common/output.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { FilterViewPane } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { TextResourceEditorInput } from '../../../common/editor/textResourceEditorInput.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { createCancelablePromise } from '../../../../base/common/async.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { computeEditorAriaLabel } from '../../../browser/editor.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { LogLevel } from '../../../../platform/log/common/log.js';
import { EditorExtensionsRegistry } from '../../../../editor/browser/editorExtensions.js';
import { Range } from '../../../../editor/common/core/range.js';
import { FindDecorations } from '../../../../editor/contrib/find/browser/findDecorations.js';
import { Memento } from '../../../common/memento.js';
import { Markers } from '../../markers/common/markers.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { viewFilterSubmenu } from '../../../browser/parts/views/viewFilter.js';
import { escapeRegExpCharacters } from '../../../../base/common/strings.js';
let OutputViewPane = class OutputViewPane extends FilterViewPane {
    get scrollLock() { return !!this.scrollLockContextKey.get(); }
    set scrollLock(scrollLock) { this.scrollLockContextKey.set(scrollLock); }
    constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, outputService, storageService) {
        const memento = new Memento(Markers.MARKERS_VIEW_STORAGE_ID, storageService);
        const viewState = memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        super({
            ...options,
            filterOptions: {
                placeholder: localize('outputView.filter.placeholder', "Filter"),
                focusContextKey: OUTPUT_FILTER_FOCUS_CONTEXT.key,
                text: viewState.filter || '',
                history: []
            }
        }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.outputService = outputService;
        this.editorPromise = null;
        this.memento = memento;
        this.panelState = viewState;
        const filters = outputService.filters;
        filters.text = this.panelState.filter || '';
        filters.trace = this.panelState.showTrace ?? true;
        filters.debug = this.panelState.showDebug ?? true;
        filters.info = this.panelState.showInfo ?? true;
        filters.warning = this.panelState.showWarning ?? true;
        filters.error = this.panelState.showError ?? true;
        filters.categories = this.panelState.categories ?? '';
        this.scrollLockContextKey = CONTEXT_OUTPUT_SCROLL_LOCK.bindTo(this.contextKeyService);
        const editorInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
        this.editor = this._register(editorInstantiationService.createInstance(OutputEditor));
        this._register(this.editor.onTitleAreaUpdate(() => {
            this.updateTitle(this.editor.getTitle());
            this.updateActions();
        }));
        this._register(this.onDidChangeBodyVisibility(() => this.onDidChangeVisibility(this.isBodyVisible())));
        this._register(this.filterWidget.onDidChangeFilterText(text => outputService.filters.text = text));
        this.checkMoreFilters();
        this._register(outputService.filters.onDidChange(() => this.checkMoreFilters()));
    }
    showChannel(channel, preserveFocus) {
        if (this.channelId !== channel.id) {
            this.setInput(channel);
        }
        if (!preserveFocus) {
            this.focus();
        }
    }
    focus() {
        super.focus();
        this.editorPromise?.then(() => this.editor.focus());
    }
    clearFilterText() {
        this.filterWidget.setFilterText('');
    }
    renderBody(container) {
        super.renderBody(container);
        this.editor.create(container);
        container.classList.add('output-view');
        const codeEditor = this.editor.getControl();
        codeEditor.setAriaOptions({ role: 'document', activeDescendant: undefined });
        this._register(codeEditor.onDidChangeModelContent(() => {
            if (!this.scrollLock) {
                this.editor.revealLastLine();
            }
        }));
        this._register(codeEditor.onDidChangeCursorPosition((e) => {
            if (e.reason !== 3 /* CursorChangeReason.Explicit */) {
                return;
            }
            if (!this.configurationService.getValue('output.smartScroll.enabled')) {
                return;
            }
            const model = codeEditor.getModel();
            if (model) {
                const newPositionLine = e.position.lineNumber;
                const lastLine = model.getLineCount();
                this.scrollLock = lastLine !== newPositionLine;
            }
        }));
    }
    layoutBodyContent(height, width) {
        this.editor.layout(new Dimension(width, height));
    }
    onDidChangeVisibility(visible) {
        this.editor.setVisible(visible);
        if (!visible) {
            this.clearInput();
        }
    }
    setInput(channel) {
        this.channelId = channel.id;
        this.checkMoreFilters();
        const input = this.createInput(channel);
        if (!this.editor.input || !input.matches(this.editor.input)) {
            this.editorPromise?.cancel();
            this.editorPromise = createCancelablePromise(token => this.editor.setInput(input, { preserveFocus: true }, Object.create(null), token));
        }
    }
    checkMoreFilters() {
        const filters = this.outputService.filters;
        this.filterWidget.checkMoreFilters(!filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error || (!!this.channelId && filters.categories.includes(`,${this.channelId}:`)));
    }
    clearInput() {
        this.channelId = undefined;
        this.editor.clearInput();
        this.editorPromise = null;
    }
    createInput(channel) {
        return this.instantiationService.createInstance(TextResourceEditorInput, channel.uri, nls.localize('output model title', "{0} - Output", channel.label), nls.localize('channel', "Output channel for '{0}'", channel.label), undefined, undefined);
    }
    saveState() {
        const filters = this.outputService.filters;
        this.panelState.filter = filters.text;
        this.panelState.showTrace = filters.trace;
        this.panelState.showDebug = filters.debug;
        this.panelState.showInfo = filters.info;
        this.panelState.showWarning = filters.warning;
        this.panelState.showError = filters.error;
        this.panelState.categories = filters.categories;
        this.memento.saveMemento();
        super.saveState();
    }
};
OutputViewPane = __decorate([
    __param(1, IKeybindingService),
    __param(2, IContextMenuService),
    __param(3, IConfigurationService),
    __param(4, IContextKeyService),
    __param(5, IViewDescriptorService),
    __param(6, IInstantiationService),
    __param(7, IOpenerService),
    __param(8, IThemeService),
    __param(9, IHoverService),
    __param(10, IOutputService),
    __param(11, IStorageService)
], OutputViewPane);
export { OutputViewPane };
let OutputEditor = class OutputEditor extends AbstractTextResourceEditor {
    constructor(telemetryService, instantiationService, storageService, configurationService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService) {
        super(OUTPUT_VIEW_ID, editorGroupService.activeGroup /* this is not correct but pragmatic */, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService);
        this.configurationService = configurationService;
        this.resourceContext = this._register(instantiationService.createInstance(ResourceContextKey));
    }
    getId() {
        return OUTPUT_VIEW_ID;
    }
    getTitle() {
        return nls.localize('output', "Output");
    }
    getConfigurationOverrides(configuration) {
        const options = super.getConfigurationOverrides(configuration);
        options.wordWrap = 'on'; // all output editors wrap
        options.lineNumbers = 'off'; // all output editors hide line numbers
        options.glyphMargin = false;
        options.lineDecorationsWidth = 20;
        options.rulers = [];
        options.folding = false;
        options.scrollBeyondLastLine = false;
        options.renderLineHighlight = 'none';
        options.minimap = { enabled: false };
        options.renderValidationDecorations = 'editable';
        options.padding = undefined;
        options.readOnly = true;
        options.domReadOnly = true;
        options.unicodeHighlight = {
            nonBasicASCII: false,
            invisibleCharacters: false,
            ambiguousCharacters: false,
        };
        const outputConfig = this.configurationService.getValue('[Log]');
        if (outputConfig) {
            if (outputConfig['editor.minimap.enabled']) {
                options.minimap = { enabled: true };
            }
            if (outputConfig['editor.wordWrap']) {
                options.wordWrap = outputConfig['editor.wordWrap'];
            }
        }
        return options;
    }
    getAriaLabel() {
        return this.input ? this.input.getAriaLabel() : nls.localize('outputViewAriaLabel', "Output panel");
    }
    computeAriaLabel() {
        return this.input ? computeEditorAriaLabel(this.input, undefined, undefined, this.editorGroupService.count) : this.getAriaLabel();
    }
    async setInput(input, options, context, token) {
        const focus = !(options && options.preserveFocus);
        if (this.input && input.matches(this.input)) {
            return;
        }
        if (this.input) {
            // Dispose previous input (Output panel is not a workbench editor)
            this.input.dispose();
        }
        await super.setInput(input, options, context, token);
        this.resourceContext.set(input.resource);
        if (focus) {
            this.focus();
        }
        this.revealLastLine();
    }
    clearInput() {
        if (this.input) {
            // Dispose current input (Output panel is not a workbench editor)
            this.input.dispose();
        }
        super.clearInput();
        this.resourceContext.reset();
    }
    createEditor(parent) {
        parent.setAttribute('role', 'document');
        super.createEditor(parent);
        const scopedContextKeyService = this.scopedContextKeyService;
        if (scopedContextKeyService) {
            CONTEXT_IN_OUTPUT.bindTo(scopedContextKeyService).set(true);
        }
    }
    _getContributions() {
        return [
            ...EditorExtensionsRegistry.getEditorContributions(),
            {
                id: FilterController.ID,
                ctor: FilterController,
                instantiation: 0 /* EditorContributionInstantiation.Eager */
            }
        ];
    }
    getCodeEditorWidgetOptions() {
        return { contributions: this._getContributions() };
    }
};
OutputEditor = __decorate([
    __param(0, ITelemetryService),
    __param(1, IInstantiationService),
    __param(2, IStorageService),
    __param(3, IConfigurationService),
    __param(4, ITextResourceConfigurationService),
    __param(5, IThemeService),
    __param(6, IEditorGroupsService),
    __param(7, IEditorService),
    __param(8, IFileService)
], OutputEditor);
export { OutputEditor };
let FilterController = class FilterController extends Disposable {
    static { this.ID = 'output.editor.contrib.filterController'; }
    constructor(editor, outputService) {
        super();
        this.editor = editor;
        this.outputService = outputService;
        this.modelDisposables = this._register(new DisposableStore());
        this.hiddenAreas = [];
        this.categories = new Map();
        this.decorationsCollection = editor.createDecorationsCollection();
        this._register(editor.onDidChangeModel(() => this.onDidChangeModel()));
        this._register(this.outputService.filters.onDidChange(() => editor.hasModel() && this.filter(editor.getModel())));
    }
    onDidChangeModel() {
        this.modelDisposables.clear();
        this.hiddenAreas = [];
        this.categories.clear();
        if (!this.editor.hasModel()) {
            return;
        }
        const model = this.editor.getModel();
        this.filter(model);
        const computeEndLineNumber = () => {
            const endLineNumber = model.getLineCount();
            return endLineNumber > 1 && model.getLineMaxColumn(endLineNumber) === 1 ? endLineNumber - 1 : endLineNumber;
        };
        let endLineNumber = computeEndLineNumber();
        this.modelDisposables.add(model.onDidChangeContent(e => {
            if (e.changes.every(e => e.range.startLineNumber > endLineNumber)) {
                this.filterIncremental(model, endLineNumber + 1);
            }
            else {
                this.filter(model);
            }
            endLineNumber = computeEndLineNumber();
        }));
    }
    filter(model) {
        this.hiddenAreas = [];
        this.decorationsCollection.clear();
        this.filterIncremental(model, 1);
    }
    filterIncremental(model, fromLineNumber) {
        const { findMatches, hiddenAreas, categories: sources } = this.compute(model, fromLineNumber);
        this.hiddenAreas.push(...hiddenAreas);
        this.editor.setHiddenAreas(this.hiddenAreas, this);
        if (findMatches.length) {
            this.decorationsCollection.append(findMatches);
        }
        if (sources.size) {
            const that = this;
            for (const [categoryFilter, categoryName] of sources) {
                if (this.categories.has(categoryFilter)) {
                    continue;
                }
                this.categories.set(categoryFilter, categoryName);
                this.modelDisposables.add(registerAction2(class extends Action2 {
                    constructor() {
                        super({
                            id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${categoryFilter}`,
                            title: categoryName,
                            toggled: ContextKeyExpr.regex(HIDE_CATEGORY_FILTER_CONTEXT.key, new RegExp(`.*,${escapeRegExpCharacters(categoryFilter)},.*`)).negate(),
                            menu: {
                                id: viewFilterSubmenu,
                                group: '1_category_filter',
                                when: ContextKeyExpr.and(ContextKeyExpr.equals('view', OUTPUT_VIEW_ID)),
                            }
                        });
                    }
                    async run() {
                        that.outputService.filters.toggleCategory(categoryFilter);
                    }
                }));
            }
        }
    }
    compute(model, fromLineNumber) {
        const filters = this.outputService.filters;
        const activeChannel = this.outputService.getActiveChannel();
        const findMatches = [];
        const hiddenAreas = [];
        const categories = new Map();
        const logEntries = activeChannel?.getLogEntries();
        if (activeChannel && logEntries?.length) {
            const hasLogLevelFilter = !filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error;
            const fromLogLevelEntryIndex = logEntries.findIndex(entry => fromLineNumber >= entry.range.startLineNumber && fromLineNumber <= entry.range.endLineNumber);
            if (fromLogLevelEntryIndex === -1) {
                return { findMatches, hiddenAreas, categories };
            }
            for (let i = fromLogLevelEntryIndex; i < logEntries.length; i++) {
                const entry = logEntries[i];
                if (entry.category) {
                    categories.set(`${activeChannel.id}:${entry.category}`, entry.category);
                }
                if (hasLogLevelFilter && !this.shouldShowLogLevel(entry, filters)) {
                    hiddenAreas.push(entry.range);
                    continue;
                }
                if (!this.shouldShowCategory(activeChannel.id, entry, filters)) {
                    hiddenAreas.push(entry.range);
                    continue;
                }
                if (filters.text) {
                    const matches = model.findMatches(filters.text, entry.range, false, false, null, false);
                    if (matches.length) {
                        for (const match of matches) {
                            findMatches.push({ range: match.range, options: FindDecorations._FIND_MATCH_DECORATION });
                        }
                    }
                    else {
                        hiddenAreas.push(entry.range);
                    }
                }
            }
            return { findMatches, hiddenAreas, categories };
        }
        if (!filters.text) {
            return { findMatches, hiddenAreas, categories };
        }
        const lineCount = model.getLineCount();
        for (let lineNumber = fromLineNumber; lineNumber <= lineCount; lineNumber++) {
            const lineRange = new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
            const matches = model.findMatches(filters.text, lineRange, false, false, null, false);
            if (matches.length) {
                for (const match of matches) {
                    findMatches.push({ range: match.range, options: FindDecorations._FIND_MATCH_DECORATION });
                }
            }
            else {
                hiddenAreas.push(lineRange);
            }
        }
        return { findMatches, hiddenAreas, categories };
    }
    shouldShowLogLevel(entry, filters) {
        switch (entry.logLevel) {
            case LogLevel.Trace:
                return filters.trace;
            case LogLevel.Debug:
                return filters.debug;
            case LogLevel.Info:
                return filters.info;
            case LogLevel.Warning:
                return filters.warning;
            case LogLevel.Error:
                return filters.error;
        }
        return true;
    }
    shouldShowCategory(activeChannelId, entry, filters) {
        if (!entry.category) {
            return true;
        }
        return !filters.hasCategory(`${activeChannelId}:${entry.category}`);
    }
};
FilterController = __decorate([
    __param(1, IOutputService)
], FilterController);
export { FilterController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Vmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvYnJvd3Nlci9vdXRwdXRWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFHMUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUNwSCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsa0JBQWtCLEVBQWUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFdkgsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDakcsT0FBTyxFQUFFLGNBQWMsRUFBRSxpQkFBaUIsRUFBa0IsMEJBQTBCLEVBQUUsY0FBYyxFQUFzQiwyQkFBMkIsRUFBYSw0QkFBNEIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BQLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUU5RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFbEYsT0FBTyxFQUFvQixjQUFjLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztB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