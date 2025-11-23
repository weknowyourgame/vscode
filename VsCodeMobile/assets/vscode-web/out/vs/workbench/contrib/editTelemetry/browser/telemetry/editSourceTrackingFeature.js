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
import { CachedFunction } from '../../../../../base/common/cache.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, mapObservableArrayCached, derived, observableValue, derivedWithSetter, observableFromEvent } from '../../../../../base/common/observable.js';
import { DynamicCssRules } from '../../../../../editor/browser/editorDom.js';
import { observableCodeEditor } from '../../../../../editor/browser/observableCodeEditor.js';
import { CodeEditorWidget } from '../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IStatusbarService } from '../../../../services/statusbar/browser/statusbar.js';
import { EditSourceTrackingImpl } from './editSourceTrackingImpl.js';
import { DataChannelForwardingTelemetryService } from '../../../../../platform/dataChannel/browser/forwardingTelemetryService.js';
import { EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR } from '../settings.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
let EditTrackingFeature = class EditTrackingFeature extends Disposable {
    constructor(_workspace, _annotatedDocuments, _configurationService, _instantiationService, _statusbarService, _editorService, _extensionService) {
        super();
        this._workspace = _workspace;
        this._annotatedDocuments = _annotatedDocuments;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._statusbarService = _statusbarService;
        this._editorService = _editorService;
        this._extensionService = _extensionService;
        this._showStateInMarkdownDoc = 'editTelemetry.showDebugDetails';
        this._toggleDecorations = 'editTelemetry.toggleDebugDecorations';
        this._editSourceTrackingShowDecorations = makeSettable(observableConfigValue(EDIT_TELEMETRY_SHOW_DECORATIONS, false, this._configurationService));
        this._editSourceTrackingShowStatusBar = observableConfigValue(EDIT_TELEMETRY_SHOW_STATUS_BAR, false, this._configurationService);
        const editSourceDetailsEnabled = observableConfigValue(EDIT_TELEMETRY_DETAILS_SETTING_ID, false, this._configurationService);
        const extensions = observableFromEvent(this._extensionService.onDidChangeExtensions, () => {
            return this._extensionService.extensions;
        });
        const extensionIds = derived(reader => new Set(extensions.read(reader).map(e => e.id?.toLowerCase())));
        function getExtensionInfoObs(extensionId, extensionService) {
            const extIdLowerCase = extensionId.toLowerCase();
            return derived(reader => extensionIds.read(reader).has(extIdLowerCase));
        }
        const copilotInstalled = getExtensionInfoObs('GitHub.copilot', this._extensionService);
        const copilotChatInstalled = getExtensionInfoObs('GitHub.copilot-chat', this._extensionService);
        const shouldSendDetails = derived(reader => editSourceDetailsEnabled.read(reader) || !!copilotInstalled.read(reader) || !!copilotChatInstalled.read(reader));
        const instantiationServiceWithInterceptedTelemetry = this._instantiationService.createChild(new ServiceCollection([ITelemetryService, this._instantiationService.createInstance(DataChannelForwardingTelemetryService)]));
        const impl = this._register(instantiationServiceWithInterceptedTelemetry.createInstance(EditSourceTrackingImpl, shouldSendDetails, this._annotatedDocuments));
        this._register(autorun((reader) => {
            if (!this._editSourceTrackingShowDecorations.read(reader)) {
                return;
            }
            const visibleEditors = observableFromEvent(this, this._editorService.onDidVisibleEditorsChange, () => this._editorService.visibleTextEditorControls);
            mapObservableArrayCached(this, visibleEditors, (editor, store) => {
                if (editor instanceof CodeEditorWidget) {
                    const obsEditor = observableCodeEditor(editor);
                    const cssStyles = new DynamicCssRules(editor);
                    const decorations = new CachedFunction((source) => {
                        const r = store.add(cssStyles.createClassNameRef({
                            backgroundColor: source.getColor(),
                        }));
                        return r.className;
                    });
                    store.add(obsEditor.setDecorations(derived(reader => {
                        const uri = obsEditor.model.read(reader)?.uri;
                        if (!uri) {
                            return [];
                        }
                        const doc = this._workspace.getDocument(uri);
                        if (!doc) {
                            return [];
                        }
                        const docsState = impl.docsState.read(reader).get(doc);
                        if (!docsState) {
                            return [];
                        }
                        const ranges = (docsState.longtermTracker.read(reader)?.getTrackedRanges(reader)) ?? [];
                        return ranges.map(r => ({
                            range: doc.value.read(undefined).getTransformer().getRange(r.range),
                            options: {
                                description: 'editSourceTracking',
                                inlineClassName: decorations.get(r.source),
                            }
                        }));
                    })));
                }
            }).recomputeInitiallyAndOnChange(reader.store);
        }));
        this._register(autorun(reader => {
            if (!this._editSourceTrackingShowStatusBar.read(reader)) {
                return;
            }
            const statusBarItem = reader.store.add(this._statusbarService.addEntry({
                name: '',
                text: '',
                command: this._showStateInMarkdownDoc,
                tooltip: 'Edit Source Tracking',
                ariaLabel: '',
            }, 'editTelemetry', 1 /* StatusbarAlignment.RIGHT */, 100));
            const sumChangedCharacters = derived(reader => {
                const docs = impl.docsState.read(reader);
                let sum = 0;
                for (const state of docs.values()) {
                    const t = state.longtermTracker.read(reader);
                    if (!t) {
                        continue;
                    }
                    const d = state.getTelemetryData(t.getTrackedRanges(reader));
                    sum += d.totalModifiedCharactersInFinalState;
                }
                return sum;
            });
            const tooltipMarkdownString = derived(reader => {
                const docs = impl.docsState.read(reader);
                const docsDataInTooltip = [];
                const editSources = [];
                for (const [doc, state] of docs) {
                    const tracker = state.longtermTracker.read(reader);
                    if (!tracker) {
                        continue;
                    }
                    const trackedRanges = tracker.getTrackedRanges(reader);
                    const data = state.getTelemetryData(trackedRanges);
                    if (data.totalModifiedCharactersInFinalState === 0) {
                        continue; // Don't include unmodified documents in tooltip
                    }
                    editSources.push(...trackedRanges.map(r => r.source));
                    // Filter out unmodified properties as these are not interesting to see in the hover
                    const filteredData = Object.fromEntries(Object.entries(data).filter(([_, value]) => !(typeof value === 'number') || value !== 0));
                    docsDataInTooltip.push([
                        `### ${doc.uri.fsPath}`,
                        '```json',
                        JSON.stringify(filteredData, undefined, '\t'),
                        '```',
                        '\n'
                    ].join('\n'));
                }
                let tooltipContent;
                if (docsDataInTooltip.length === 0) {
                    tooltipContent = 'No modified documents';
                }
                else if (docsDataInTooltip.length <= 3) {
                    tooltipContent = docsDataInTooltip.join('\n\n');
                }
                else {
                    const lastThree = docsDataInTooltip.slice(-3);
                    tooltipContent = '...\n\n' + lastThree.join('\n\n');
                }
                const agenda = this._createEditSourceAgenda(editSources);
                const tooltipWithCommand = new MarkdownString(tooltipContent + '\n\n[View Details](command:' + this._showStateInMarkdownDoc + ')');
                tooltipWithCommand.appendMarkdown('\n\n' + agenda + '\n\nToggle decorations: [Click here](command:' + this._toggleDecorations + ')');
                tooltipWithCommand.isTrusted = { enabledCommands: [this._toggleDecorations] };
                tooltipWithCommand.supportHtml = true;
                return tooltipWithCommand;
            });
            reader.store.add(autorun(reader => {
                statusBarItem.update({
                    name: 'editTelemetry',
                    text: `$(edit) ${sumChangedCharacters.read(reader)} chars inserted`,
                    ariaLabel: `Edit Source Tracking: ${sumChangedCharacters.read(reader)} modified characters`,
                    tooltip: tooltipMarkdownString.read(reader),
                    command: this._showStateInMarkdownDoc,
                });
            }));
            reader.store.add(CommandsRegistry.registerCommand(this._toggleDecorations, () => {
                this._editSourceTrackingShowDecorations.set(!this._editSourceTrackingShowDecorations.read(undefined), undefined);
            }));
        }));
    }
    _createEditSourceAgenda(editSources) {
        // Collect all edit sources from the tracked documents
        const editSourcesSeen = new Set();
        const editSourceInfo = [];
        for (const editSource of editSources) {
            if (!editSourcesSeen.has(editSource.toString())) {
                editSourcesSeen.add(editSource.toString());
                editSourceInfo.push({ name: editSource.toString(), color: editSource.getColor() });
            }
        }
        const agendaItems = editSourceInfo.map(info => `<span style="background-color:${info.color};border-radius:3px;">${info.name}</span>`);
        return agendaItems.join(' ');
    }
};
EditTrackingFeature = __decorate([
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, IStatusbarService),
    __param(5, IEditorService),
    __param(6, IExtensionService)
], EditTrackingFeature);
export { EditTrackingFeature };
function makeSettable(obs) {
    const overrideObs = observableValue('overrideObs', undefined);
    return derivedWithSetter(overrideObs, (reader) => {
        return overrideObs.read(reader) ?? obs.read(reader);
    }, (value, tx) => {
        overrideObs.set(value, tx);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFNvdXJjZVRyYWNraW5nRmVhdHVyZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvdGVsZW1ldHJ5L2VkaXRTb3VyY2VUcmFja2luZ0ZlYXR1cmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxPQUFPLEVBQW9DLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pNLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUV2RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUM3RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1B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