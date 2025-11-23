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
var QuickDiffDecorator_1;
import * as nls from '../../../../nls.js';
import './media/dirtydiffDecorator.css';
import { Disposable, DisposableStore, DisposableMap } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ModelDecorationOptions } from '../../../../editor/common/model/textModel.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { OverviewRulerLane } from '../../../../editor/common/model.js';
import * as domStylesheetsJs from '../../../../base/browser/domStylesheets.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ChangeType, getChangeType, IQuickDiffService, minimapGutterAddedBackground, minimapGutterDeletedBackground, minimapGutterModifiedBackground, overviewRulerAddedForeground, overviewRulerDeletedForeground, overviewRulerModifiedForeground } from '../common/quickDiff.js';
import { IQuickDiffModelService } from './quickDiffModel.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ContextKeyTrueExpr, ContextKeyFalseExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { registerAction2, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
export const quickDiffDecorationCount = new RawContextKey('quickDiffDecorationCount', 0);
let QuickDiffDecorator = QuickDiffDecorator_1 = class QuickDiffDecorator extends Disposable {
    static createDecoration(className, tooltip, options) {
        const decorationOptions = {
            description: 'dirty-diff-decoration',
            isWholeLine: options.isWholeLine,
        };
        if (options.gutter) {
            decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
            decorationOptions.linesDecorationsTooltip = tooltip;
        }
        if (options.overview.active) {
            decorationOptions.overviewRuler = {
                color: themeColorFromId(options.overview.color),
                position: OverviewRulerLane.Left
            };
        }
        if (options.minimap.active) {
            decorationOptions.minimap = {
                color: themeColorFromId(options.minimap.color),
                position: 2 /* MinimapPosition.Gutter */
            };
        }
        return ModelDecorationOptions.createDynamic(decorationOptions);
    }
    constructor(codeEditor, quickDiffModelRef, configurationService, quickDiffService) {
        super();
        this.codeEditor = codeEditor;
        this.quickDiffModelRef = quickDiffModelRef;
        this.configurationService = configurationService;
        this.quickDiffService = quickDiffService;
        const decorations = configurationService.getValue('scm.diffDecorations');
        const gutter = decorations === 'all' || decorations === 'gutter';
        const overview = decorations === 'all' || decorations === 'overview';
        const minimap = decorations === 'all' || decorations === 'minimap';
        const diffAdded = nls.localize('diffAdded', 'Added lines');
        const diffAddedOptions = {
            gutter,
            overview: { active: overview, color: overviewRulerAddedForeground },
            minimap: { active: minimap, color: minimapGutterAddedBackground },
            isWholeLine: true
        };
        this.addedOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-added primary', diffAdded, diffAddedOptions);
        this.addedPatternOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-added primary pattern', diffAdded, diffAddedOptions);
        this.addedSecondaryOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-added secondary', diffAdded, diffAddedOptions);
        this.addedSecondaryPatternOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-added secondary pattern', diffAdded, diffAddedOptions);
        const diffModified = nls.localize('diffModified', 'Changed lines');
        const diffModifiedOptions = {
            gutter,
            overview: { active: overview, color: overviewRulerModifiedForeground },
            minimap: { active: minimap, color: minimapGutterModifiedBackground },
            isWholeLine: true
        };
        this.modifiedOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-modified primary', diffModified, diffModifiedOptions);
        this.modifiedPatternOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-modified primary pattern', diffModified, diffModifiedOptions);
        this.modifiedSecondaryOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-modified secondary', diffModified, diffModifiedOptions);
        this.modifiedSecondaryPatternOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-modified secondary pattern', diffModified, diffModifiedOptions);
        const diffDeleted = nls.localize('diffDeleted', 'Removed lines');
        const diffDeletedOptions = {
            gutter,
            overview: { active: overview, color: overviewRulerDeletedForeground },
            minimap: { active: minimap, color: minimapGutterDeletedBackground },
            isWholeLine: false
        };
        this.deletedOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-deleted primary', diffDeleted, diffDeletedOptions);
        this.deletedSecondaryOptions = QuickDiffDecorator_1.createDecoration('dirty-diff-deleted secondary', diffDeleted, diffDeletedOptions);
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('scm.diffDecorationsGutterPattern')) {
                this.onDidChange();
            }
        }));
        this._register(Event.runAndSubscribe(this.quickDiffModelRef.object.onDidChange, () => this.onDidChange()));
    }
    onDidChange() {
        if (!this.codeEditor.hasModel()) {
            return;
        }
        const pattern = this.configurationService.getValue('scm.diffDecorationsGutterPattern');
        const primaryQuickDiff = this.quickDiffModelRef.object.quickDiffs.find(quickDiff => quickDiff.kind === 'primary');
        const primaryQuickDiffChanges = this.quickDiffModelRef.object.changes.filter(change => change.providerId === primaryQuickDiff?.id);
        const decorations = [];
        for (const change of this.quickDiffModelRef.object.changes) {
            const quickDiff = this.quickDiffModelRef.object.quickDiffs
                .find(quickDiff => quickDiff.id === change.providerId);
            // Skip quick diffs that are not visible
            if (!quickDiff || !this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id)) {
                continue;
            }
            if (quickDiff.kind !== 'primary' && primaryQuickDiffChanges.some(c => c.change2.modified.intersectsOrTouches(change.change2.modified))) {
                // Overlap with primary quick diff changes
                continue;
            }
            const changeType = getChangeType(change.change);
            const startLineNumber = change.change.modifiedStartLineNumber;
            const endLineNumber = change.change.modifiedEndLineNumber || startLineNumber;
            switch (changeType) {
                case ChangeType.Add:
                    decorations.push({
                        range: {
                            startLineNumber: startLineNumber, startColumn: 1,
                            endLineNumber: endLineNumber, endColumn: 1
                        },
                        options: quickDiff.kind === 'primary' || quickDiff.kind === 'contributed'
                            ? pattern.added ? this.addedPatternOptions : this.addedOptions
                            : pattern.added ? this.addedSecondaryPatternOptions : this.addedSecondaryOptions
                    });
                    break;
                case ChangeType.Delete:
                    decorations.push({
                        range: {
                            startLineNumber: startLineNumber, startColumn: Number.MAX_VALUE,
                            endLineNumber: startLineNumber, endColumn: Number.MAX_VALUE
                        },
                        options: quickDiff.kind === 'primary' || quickDiff.kind === 'contributed'
                            ? this.deletedOptions
                            : this.deletedSecondaryOptions
                    });
                    break;
                case ChangeType.Modify:
                    decorations.push({
                        range: {
                            startLineNumber: startLineNumber, startColumn: 1,
                            endLineNumber: endLineNumber, endColumn: 1
                        },
                        options: quickDiff.kind === 'primary' || quickDiff.kind === 'contributed'
                            ? pattern.modified ? this.modifiedPatternOptions : this.modifiedOptions
                            : pattern.modified ? this.modifiedSecondaryPatternOptions : this.modifiedSecondaryOptions
                    });
                    break;
            }
        }
        if (!this.decorationsCollection) {
            this.decorationsCollection = this.codeEditor.createDecorationsCollection(decorations);
        }
        else {
            this.decorationsCollection.set(decorations);
        }
    }
    dispose() {
        if (this.decorationsCollection) {
            this.decorationsCollection.clear();
        }
        this.decorationsCollection = undefined;
        this.quickDiffModelRef.dispose();
        super.dispose();
    }
};
QuickDiffDecorator = QuickDiffDecorator_1 = __decorate([
    __param(2, IConfigurationService),
    __param(3, IQuickDiffService)
], QuickDiffDecorator);
let QuickDiffWorkbenchController = class QuickDiffWorkbenchController extends Disposable {
    constructor(editorService, configurationService, quickDiffModelService, quickDiffService, uriIdentityService, contextKeyService) {
        super();
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.quickDiffModelService = quickDiffModelService;
        this.quickDiffService = quickDiffService;
        this.uriIdentityService = uriIdentityService;
        this.enabled = false;
        // Resource URI -> Code Editor Id -> Decoration (Disposable)
        this.decorators = new ResourceMap();
        this.viewState = { width: 3, visibility: 'always' };
        this.transientDisposables = this._register(new DisposableStore());
        this.stylesheet = domStylesheetsJs.createStyleSheet(undefined, undefined, this._store);
        this.quickDiffDecorationCount = quickDiffDecorationCount.bindTo(contextKeyService);
        this.activeEditor = observableFromEvent(this, this.editorService.onDidActiveEditorChange, () => this.editorService.activeEditor);
        this.quickDiffProviders = observableFromEvent(this, this.quickDiffService.onDidChangeQuickDiffProviders, () => this.quickDiffService.providers);
        const onDidChangeConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorations'));
        this._register(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
        this.onDidChangeConfiguration();
        const onDidChangeDiffWidthConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterWidth'));
        this._register(onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this));
        this.onDidChangeDiffWidthConfiguration();
        const onDidChangeDiffVisibilityConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterVisibility'));
        this._register(onDidChangeDiffVisibilityConfiguration(this.onDidChangeDiffVisibilityConfiguration, this));
        this.onDidChangeDiffVisibilityConfiguration();
    }
    onDidChangeConfiguration() {
        const enabled = this.configurationService.getValue('scm.diffDecorations') !== 'none';
        if (enabled) {
            this.enable();
        }
        else {
            this.disable();
        }
    }
    onDidChangeDiffWidthConfiguration() {
        let width = this.configurationService.getValue('scm.diffDecorationsGutterWidth');
        if (isNaN(width) || width <= 0 || width > 5) {
            width = 3;
        }
        this.setViewState({ ...this.viewState, width });
    }
    onDidChangeDiffVisibilityConfiguration() {
        const visibility = this.configurationService.getValue('scm.diffDecorationsGutterVisibility');
        this.setViewState({ ...this.viewState, visibility });
    }
    setViewState(state) {
        this.viewState = state;
        this.stylesheet.textContent = `
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified {
				border-left-width:${state.width}px;
			}
			.monaco-editor .dirty-diff-added.pattern,
			.monaco-editor .dirty-diff-added.pattern:before,
			.monaco-editor .dirty-diff-modified.pattern,
			.monaco-editor .dirty-diff-modified.pattern:before {
				background-size: ${state.width}px ${state.width}px;
			}
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified,
			.monaco-editor .dirty-diff-deleted {
				opacity: ${state.visibility === 'always' ? 1 : 0};
			}
		`;
    }
    enable() {
        if (this.enabled) {
            this.disable();
        }
        this.transientDisposables.add(Event.any(this.editorService.onDidCloseEditor, this.editorService.onDidVisibleEditorsChange)(() => this.onEditorsChanged()));
        this.onEditorsChanged();
        this.onDidActiveEditorChange();
        this.onDidChangeQuickDiffProviders();
        this.enabled = true;
    }
    disable() {
        if (!this.enabled) {
            return;
        }
        this.transientDisposables.clear();
        this.quickDiffDecorationCount.set(0);
        for (const [uri, decoratorMap] of this.decorators.entries()) {
            decoratorMap.dispose();
            this.decorators.delete(uri);
        }
        this.enabled = false;
    }
    onDidActiveEditorChange() {
        this.transientDisposables.add(autorun(reader => {
            const activeEditor = this.activeEditor.read(reader);
            const activeTextEditorControl = this.editorService.activeTextEditorControl;
            if (!isCodeEditor(activeTextEditorControl) || !activeEditor?.resource) {
                this.quickDiffDecorationCount.set(0);
                return;
            }
            const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(activeEditor.resource);
            if (!quickDiffModelRef) {
                this.quickDiffDecorationCount.set(0);
                return;
            }
            reader.store.add(quickDiffModelRef);
            const visibleDecorationCount = observableFromEvent(this, quickDiffModelRef.object.onDidChange, () => {
                const visibleQuickDiffs = quickDiffModelRef.object.quickDiffs.filter(quickDiff => this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id));
                return quickDiffModelRef.object.changes.filter(change => visibleQuickDiffs.some(quickDiff => quickDiff.id === change.providerId)).length;
            });
            reader.store.add(autorun(reader => {
                const count = visibleDecorationCount.read(reader);
                this.quickDiffDecorationCount.set(count);
            }));
        }));
    }
    onDidChangeQuickDiffProviders() {
        this.transientDisposables.add(autorun(reader => {
            const providers = this.quickDiffProviders.read(reader);
            const labels = [];
            for (let index = 0; index < providers.length; index++) {
                const provider = providers[index];
                if (labels.includes(provider.label)) {
                    continue;
                }
                const visible = this.quickDiffService.isQuickDiffProviderVisible(provider.id);
                const group = provider.kind !== 'contributed' ? '0_scm' : '1_contributed';
                const order = index + 1;
                reader.store.add(registerAction2(class extends Action2 {
                    constructor() {
                        super({
                            id: `workbench.scm.action.toggleQuickDiffVisibility.${provider.id}`,
                            title: provider.label,
                            toggled: visible ? ContextKeyTrueExpr.INSTANCE : ContextKeyFalseExpr.INSTANCE,
                            menu: {
                                id: MenuId.SCMQuickDiffDecorations, group, order
                            },
                            f1: false
                        });
                    }
                    run(accessor) {
                        const quickDiffService = accessor.get(IQuickDiffService);
                        quickDiffService.toggleQuickDiffProviderVisibility(provider.id);
                    }
                }));
                labels.push(provider.label);
            }
        }));
    }
    onEditorsChanged() {
        for (const editor of this.editorService.visibleTextEditorControls) {
            if (!isCodeEditor(editor)) {
                continue;
            }
            const textModel = editor.getModel();
            if (!textModel) {
                continue;
            }
            const editorId = editor.getId();
            if (this.decorators.get(textModel.uri)?.has(editorId)) {
                continue;
            }
            const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(textModel.uri);
            if (!quickDiffModelRef) {
                continue;
            }
            if (!this.decorators.has(textModel.uri)) {
                this.decorators.set(textModel.uri, new DisposableMap());
            }
            this.decorators.get(textModel.uri).set(editorId, new QuickDiffDecorator(editor, quickDiffModelRef, this.configurationService, this.quickDiffService));
        }
        // Dispose decorators for editors that are no longer visible.
        for (const [uri, decoratorMap] of this.decorators.entries()) {
            for (const editorId of decoratorMap.keys()) {
                const codeEditor = this.editorService.visibleTextEditorControls
                    .find(editor => isCodeEditor(editor) && editor.getId() === editorId &&
                    this.uriIdentityService.extUri.isEqual(editor.getModel()?.uri, uri));
                if (!codeEditor) {
                    decoratorMap.deleteAndDispose(editorId);
                }
            }
            if (decoratorMap.size === 0) {
                decoratorMap.dispose();
                this.decorators.delete(uri);
            }
        }
    }
    dispose() {
        this.disable();
        super.dispose();
    }
};
QuickDiffWorkbenchController = __decorate([
    __param(0, IEditorService),
    __param(1, IConfigurationService),
    __param(2, IQuickDiffModelService),
    __param(3, IQuickDiffService),
    __param(4, IUriIdentityService),
    __param(5, IContextKeyService)
], QuickDiffWorkbenchController);
export { QuickDiffWorkbenchController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tEaWZmRGVjb3JhdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9icm93c2VyL3F1aWNrRGlmZkRlY29yYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxPQUFPLGdDQUFnQyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBYyxNQUFNLHNDQUFzQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRixPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFeEYsT0FBTyxFQUFFLGlCQUFpQixFQUFtRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3hJLE9BQU8sS0FBSyxnQkFBZ0IsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQXFCLDRCQUE0QixFQUFFLDhCQUE4QixFQUFFLCtCQUErQixFQUFFLDRCQUE0QixFQUFFLDhCQUE4QixFQUFFLCtCQUErQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdlMsT0FBTyxFQUFrQixzQkFBc0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRTdFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FB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