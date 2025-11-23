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
import { addDisposableListener, EventType, h, reset } from '../../../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Toggle } from '../../../../../../base/browser/ui/toggle/toggle.js';
import { Action, Separator } from '../../../../../../base/common/actions.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { clamp } from '../../../../../../base/common/numbers.js';
import { autorun, autorunOpts, derived, derivedOpts, observableValue, transaction } from '../../../../../../base/common/observable.js';
import { noBreakWhitespace } from '../../../../../../base/common/strings.js';
import { isDefined } from '../../../../../../base/common/types.js';
import { OverviewRulerLane } from '../../../../../../editor/common/model.js';
import { localize } from '../../../../../../nls.js';
import { MenuId } from '../../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { defaultToggleStyles } from '../../../../../../platform/theme/browser/defaultStyles.js';
import { applyObservableDecorations, setFields } from '../../utils.js';
import { handledConflictMinimapOverViewRulerColor, unhandledConflictMinimapOverViewRulerColor } from '../colors.js';
import { EditorGutter } from '../editorGutter.js';
import { CodeEditorView, createSelectionsAutorun, TitleMenu } from './codeEditorView.js';
let InputCodeEditorView = class InputCodeEditorView extends CodeEditorView {
    constructor(inputNumber, viewModel, instantiationService, contextMenuService, configurationService) {
        super(instantiationService, viewModel, configurationService);
        this.inputNumber = inputNumber;
        this.otherInputNumber = this.inputNumber === 1 ? 2 : 1;
        this.modifiedBaseRangeGutterItemInfos = derivedOpts({ debugName: `input${this.inputNumber}.modifiedBaseRangeGutterItemInfos` }, reader => {
            const viewModel = this.viewModel.read(reader);
            if (!viewModel) {
                return [];
            }
            const model = viewModel.model;
            const inputNumber = this.inputNumber;
            const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
            return model.modifiedBaseRanges.read(reader)
                .filter((r) => r.getInputDiffs(this.inputNumber).length > 0 && (showNonConflictingChanges || r.isConflicting || !model.isHandled(r).read(reader)))
                .map((baseRange, idx) => new ModifiedBaseRangeGutterItemModel(idx.toString(), baseRange, inputNumber, viewModel));
        });
        this.decorations = derivedOpts({ debugName: `input${this.inputNumber}.decorations` }, reader => {
            const viewModel = this.viewModel.read(reader);
            if (!viewModel) {
                return [];
            }
            const model = viewModel.model;
            const textModel = (this.inputNumber === 1 ? model.input1 : model.input2).textModel;
            const activeModifiedBaseRange = viewModel.activeModifiedBaseRange.read(reader);
            const result = new Array();
            const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
            const showDeletionMarkers = this.showDeletionMarkers.read(reader);
            const diffWithThis = viewModel.baseCodeEditorView.read(reader) !== undefined && viewModel.baseShowDiffAgainst.read(reader) === this.inputNumber;
            const useSimplifiedDecorations = !diffWithThis && this.useSimplifiedDecorations.read(reader);
            for (const modifiedBaseRange of model.modifiedBaseRanges.read(reader)) {
                const range = modifiedBaseRange.getInputRange(this.inputNumber);
                if (!range) {
                    continue;
                }
                const blockClassNames = ['merge-editor-block'];
                let blockPadding = [0, 0, 0, 0];
                const isHandled = model.isInputHandled(modifiedBaseRange, this.inputNumber).read(reader);
                if (isHandled) {
                    blockClassNames.push('handled');
                }
                if (modifiedBaseRange === activeModifiedBaseRange) {
                    blockClassNames.push('focused');
                    blockPadding = [0, 2, 0, 2];
                }
                if (modifiedBaseRange.isConflicting) {
                    blockClassNames.push('conflicting');
                }
                const inputClassName = this.inputNumber === 1 ? 'input i1' : 'input i2';
                blockClassNames.push(inputClassName);
                if (!modifiedBaseRange.isConflicting && !showNonConflictingChanges && isHandled) {
                    continue;
                }
                if (useSimplifiedDecorations && !isHandled) {
                    blockClassNames.push('use-simplified-decorations');
                }
                result.push({
                    range: range.toInclusiveRangeOrEmpty(),
                    options: {
                        showIfCollapsed: true,
                        blockClassName: blockClassNames.join(' '),
                        blockPadding,
                        blockIsAfterEnd: range.startLineNumber > textModel.getLineCount(),
                        description: 'Merge Editor',
                        minimap: {
                            position: 2 /* MinimapPosition.Gutter */,
                            color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor },
                        },
                        overviewRuler: modifiedBaseRange.isConflicting ? {
                            position: OverviewRulerLane.Center,
                            color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor },
                        } : undefined
                    }
                });
                if (!useSimplifiedDecorations && (modifiedBaseRange.isConflicting || !model.isHandled(modifiedBaseRange).read(reader))) {
                    const inputDiffs = modifiedBaseRange.getInputDiffs(this.inputNumber);
                    for (const diff of inputDiffs) {
                        const range = diff.outputRange.toInclusiveRange();
                        if (range) {
                            result.push({
                                range,
                                options: {
                                    className: `merge-editor-diff ${inputClassName}`,
                                    description: 'Merge Editor',
                                    isWholeLine: true,
                                }
                            });
                        }
                        if (diff.rangeMappings) {
                            for (const d of diff.rangeMappings) {
                                if (showDeletionMarkers || !d.outputRange.isEmpty()) {
                                    result.push({
                                        range: d.outputRange,
                                        options: {
                                            className: d.outputRange.isEmpty() ? `merge-editor-diff-empty-word ${inputClassName}` : `merge-editor-diff-word ${inputClassName}`,
                                            description: 'Merge Editor',
                                            showIfCollapsed: true,
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }
            return result;
        });
        this.htmlElements.root.classList.add(`input`);
        this._register(new EditorGutter(this.editor, this.htmlElements.gutterDiv, {
            getIntersectingGutterItems: (range, reader) => {
                if (this.checkboxesVisible.read(reader)) {
                    return this.modifiedBaseRangeGutterItemInfos.read(reader);
                }
                else {
                    return [];
                }
            },
            createView: (item, target) => new MergeConflictGutterItemView(item, target, contextMenuService),
        }));
        this._register(createSelectionsAutorun(this, (baseRange, viewModel) => viewModel.model.translateBaseRangeToInput(this.inputNumber, baseRange)));
        this._register(instantiationService.createInstance(TitleMenu, inputNumber === 1 ? MenuId.MergeInput1Toolbar : MenuId.MergeInput2Toolbar, this.htmlElements.toolbar));
        this._register(autorunOpts({ debugName: `input${this.inputNumber}: update labels & text model` }, reader => {
            const vm = this.viewModel.read(reader);
            if (!vm) {
                return;
            }
            this.editor.setModel(this.inputNumber === 1 ? vm.model.input1.textModel : vm.model.input2.textModel);
            const title = this.inputNumber === 1
                ? vm.model.input1.title || localize('input1', 'Input 1')
                : vm.model.input2.title || localize('input2', 'Input 2');
            const description = this.inputNumber === 1
                ? vm.model.input1.description
                : vm.model.input2.description;
            const detail = this.inputNumber === 1
                ? vm.model.input1.detail
                : vm.model.input2.detail;
            reset(this.htmlElements.title, ...renderLabelWithIcons(title));
            reset(this.htmlElements.description, ...(description ? renderLabelWithIcons(description) : []));
            reset(this.htmlElements.detail, ...(detail ? renderLabelWithIcons(detail) : []));
        }));
        this._register(applyObservableDecorations(this.editor, this.decorations));
    }
};
InputCodeEditorView = __decorate([
    __param(2, IInstantiationService),
    __param(3, IContextMenuService),
    __param(4, IConfigurationService)
], InputCodeEditorView);
export { InputCodeEditorView };
export class ModifiedBaseRangeGutterItemModel {
    constructor(id, baseRange, inputNumber, viewModel) {
        this.id = id;
        this.baseRange = baseRange;
        this.inputNumber = inputNumber;
        this.viewModel = viewModel;
        this.model = this.viewModel.model;
        this.range = this.baseRange.getInputRange(this.inputNumber);
        this.enabled = this.model.isUpToDate;
        this.toggleState = derived(this, reader => {
            const input = this.model
                .getState(this.baseRange)
                .read(reader)
                .getInput(this.inputNumber);
            return input === 2 /* InputState.second */ && !this.baseRange.isOrderRelevant
                ? 1 /* InputState.first */
                : input;
        });
        this.state = derived(this, reader => {
            const active = this.viewModel.activeModifiedBaseRange.read(reader);
            if (!this.model.hasBaseRange(this.baseRange)) {
                return { handled: false, focused: false }; // Invalid state, should only be observed temporarily
            }
            return {
                handled: this.model.isHandled(this.baseRange).read(reader),
                focused: this.baseRange === active,
            };
        });
    }
    setState(value, tx) {
        this.viewModel.setState(this.baseRange, this.model
            .getState(this.baseRange)
            .get()
            .withInputValue(this.inputNumber, value), tx, this.inputNumber);
    }
    toggleBothSides() {
        transaction(tx => {
            /** @description Context Menu: toggle both sides */
            const state = this.model
                .getState(this.baseRange)
                .get();
            this.model.setState(this.baseRange, state
                .toggle(this.inputNumber)
                .toggle(this.inputNumber === 1 ? 2 : 1), true, tx);
        });
    }
    getContextMenuActions() {
        const state = this.model.getState(this.baseRange).get();
        const handled = this.model.isHandled(this.baseRange).get();
        const update = (newState) => {
            transaction(tx => {
                /** @description Context Menu: Update Base Range State */
                return this.viewModel.setState(this.baseRange, newState, tx, this.inputNumber);
            });
        };
        function action(id, label, targetState, checked) {
            const action = new Action(id, label, undefined, true, () => {
                update(targetState);
            });
            action.checked = checked;
            return action;
        }
        const both = state.includesInput1 && state.includesInput2;
        return [
            this.baseRange.input1Diffs.length > 0
                ? action('mergeEditor.acceptInput1', localize('mergeEditor.accept', 'Accept {0}', this.model.input1.title), state.toggle(1), state.includesInput1)
                : undefined,
            this.baseRange.input2Diffs.length > 0
                ? action('mergeEditor.acceptInput2', localize('mergeEditor.accept', 'Accept {0}', this.model.input2.title), state.toggle(2), state.includesInput2)
                : undefined,
            this.baseRange.isConflicting
                ? setFields(action('mergeEditor.acceptBoth', localize('mergeEditor.acceptBoth', 'Accept Both'), state.withInputValue(1, !both).withInputValue(2, !both), both), { enabled: this.baseRange.canBeCombined })
                : undefined,
            new Separator(),
            this.baseRange.isConflicting
                ? setFields(action('mergeEditor.swap', localize('mergeEditor.swap', 'Swap'), state.swap(), false), { enabled: !state.kind && (!both || this.baseRange.isOrderRelevant) })
                : undefined,
            setFields(new Action('mergeEditor.markAsHandled', localize('mergeEditor.markAsHandled', 'Mark as Handled'), undefined, true, () => {
                transaction((tx) => {
                    /** @description Context Menu: Mark as handled */
                    this.model.setHandled(this.baseRange, !handled, tx);
                });
            }), { checked: handled }),
        ].filter(isDefined);
    }
}
export class MergeConflictGutterItemView extends Disposable {
    constructor(item, target, contextMenuService) {
        super();
        this.isMultiLine = observableValue(this, false);
        this.item = observableValue(this, item);
        const checkBox = new Toggle({
            isChecked: false,
            title: '',
            icon: Codicon.check,
            ...defaultToggleStyles
        });
        checkBox.domNode.classList.add('accept-conflict-group');
        this._register(addDisposableListener(checkBox.domNode, EventType.MOUSE_DOWN, (e) => {
            const item = this.item.get();
            if (!item) {
                return;
            }
            if (e.button === /* Right */ 2) {
                e.stopPropagation();
                e.preventDefault();
                contextMenuService.showContextMenu({
                    getAnchor: () => checkBox.domNode,
                    getActions: () => item.getContextMenuActions(),
                });
            }
            else if (e.button === /* Middle */ 1) {
                e.stopPropagation();
                e.preventDefault();
                item.toggleBothSides();
            }
        }));
        this._register(autorun(reader => {
            /** @description Update Checkbox */
            const item = this.item.read(reader);
            const value = item.toggleState.read(reader);
            const iconMap = {
                [0 /* InputState.excluded */]: { icon: undefined, checked: false, title: localize('accept.excluded', "Accept") },
                [3 /* InputState.unrecognized */]: { icon: Codicon.circleFilled, checked: false, title: localize('accept.conflicting', "Accept (result is dirty)") },
                [1 /* InputState.first */]: { icon: Codicon.check, checked: true, title: localize('accept.first', "Undo accept") },
                [2 /* InputState.second */]: { icon: Codicon.checkAll, checked: true, title: localize('accept.second', "Undo accept (currently second)") },
            };
            const state = iconMap[value];
            checkBox.setIcon(state.icon);
            checkBox.checked = state.checked;
            checkBox.setTitle(state.title);
            if (!item.enabled.read(reader)) {
                checkBox.disable();
            }
            else {
                checkBox.enable();
            }
        }));
        this._register(autorun(reader => {
            /** @description Update Checkbox CSS ClassNames */
            const state = this.item.read(reader).state.read(reader);
            const classNames = [
                'merge-accept-gutter-marker',
                state.handled && 'handled',
                state.focused && 'focused',
                this.isMultiLine.read(reader) ? 'multi-line' : 'single-line',
            ];
            target.className = classNames.filter(c => typeof c === 'string').join(' ');
        }));
        this._register(checkBox.onChange(() => {
            transaction(tx => {
                /** @description Handle Checkbox Change */
                this.item.get().setState(checkBox.checked, tx);
            });
        }));
        target.appendChild(h('div.background', [noBreakWhitespace]).root);
        target.appendChild(this.checkboxDiv = h('div.checkbox', [h('div.checkbox-background', [checkBox.domNode])]).root);
    }
    layout(top, height, viewTop, viewHeight) {
        const checkboxHeight = this.checkboxDiv.clientHeight;
        const middleHeight = height / 2 - checkboxHeight / 2;
        const margin = checkboxHeight;
        let effectiveCheckboxTop = top + middleHeight;
        const preferredViewPortRange = [
            margin,
            viewTop + viewHeight - margin - checkboxHeight
        ];
        const preferredParentRange = [
            top + margin,
            top + height - checkboxHeight - margin
        ];
        if (preferredParentRange[0] < preferredParentRange[1]) {
            effectiveCheckboxTop = clamp(effectiveCheckboxTop, preferredViewPortRange[0], preferredViewPortRange[1]);
            effectiveCheckboxTop = clamp(effectiveCheckboxTop, preferredParentRange[0], preferredParentRange[1]);
        }
        this.checkboxDiv.style.top = `${effectiveCheckboxTop - top}px`;
        transaction((tx) => {
            /** @description MergeConflictGutterItemView: Update Is Multi Line */
            this.isMultiLine.set(height > 30, tx);
        });
    }
    update(baseRange) {
        transaction(tx => {
            /** @description MergeConflictGutterItemView: Updating new base range */
            this.item.set(baseRange, tx);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXRDb2RlRWRpdG9yVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvZWRpdG9ycy9pbnB1dENvZGVFZGl0b3JWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsTUFBTSxFQUFXLFNBQVMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQWtELGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN2TCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUU3RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxFQUEwQyxpQkFBaUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3JILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDOUUsT0FBTyxF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