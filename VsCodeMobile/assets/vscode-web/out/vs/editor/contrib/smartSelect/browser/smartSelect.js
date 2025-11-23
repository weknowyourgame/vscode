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
var SmartSelectController_1;
import * as arrays from '../../../../base/common/arrays.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { onUnexpectedExternalError } from '../../../../base/common/errors.js';
import { EditorAction, registerEditorAction, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { Selection } from '../../../common/core/selection.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { BracketSelectionRangeProvider } from './bracketSelections.js';
import { WordSelectionRangeProvider } from './wordSelections.js';
import * as nls from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { ITextModelService } from '../../../common/services/resolverService.js';
import { assertType, isArrayOf } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
class SelectionRanges {
    constructor(index, ranges) {
        this.index = index;
        this.ranges = ranges;
    }
    mov(fwd) {
        const index = this.index + (fwd ? 1 : -1);
        if (index < 0 || index >= this.ranges.length) {
            return this;
        }
        const res = new SelectionRanges(index, this.ranges);
        if (res.ranges[index].equalsRange(this.ranges[this.index])) {
            // next range equals this range, retry with next-next
            return res.mov(fwd);
        }
        return res;
    }
}
let SmartSelectController = class SmartSelectController {
    static { SmartSelectController_1 = this; }
    static { this.ID = 'editor.contrib.smartSelectController'; }
    static get(editor) {
        return editor.getContribution(SmartSelectController_1.ID);
    }
    constructor(_editor, _languageFeaturesService) {
        this._editor = _editor;
        this._languageFeaturesService = _languageFeaturesService;
        this._ignoreSelection = false;
    }
    dispose() {
        this._selectionListener?.dispose();
    }
    async run(forward) {
        if (!this._editor.hasModel()) {
            return;
        }
        const selections = this._editor.getSelections();
        const model = this._editor.getModel();
        if (!this._state) {
            await provideSelectionRanges(this._languageFeaturesService.selectionRangeProvider, model, selections.map(s => s.getPosition()), this._editor.getOption(129 /* EditorOption.smartSelect */), CancellationToken.None).then(ranges => {
                if (!arrays.isNonEmptyArray(ranges) || ranges.length !== selections.length) {
                    // invalid result
                    return;
                }
                if (!this._editor.hasModel() || !arrays.equals(this._editor.getSelections(), selections, (a, b) => a.equalsSelection(b))) {
                    // invalid editor state
                    return;
                }
                for (let i = 0; i < ranges.length; i++) {
                    ranges[i] = ranges[i].filter(range => {
                        // filter ranges inside the selection
                        return range.containsPosition(selections[i].getStartPosition()) && range.containsPosition(selections[i].getEndPosition());
                    });
                    // prepend current selection
                    ranges[i].unshift(selections[i]);
                }
                this._state = ranges.map(ranges => new SelectionRanges(0, ranges));
                // listen to caret move and forget about state
                this._selectionListener?.dispose();
                this._selectionListener = this._editor.onDidChangeCursorPosition(() => {
                    if (!this._ignoreSelection) {
                        this._selectionListener?.dispose();
                        this._state = undefined;
                    }
                });
            });
        }
        if (!this._state) {
            // no state
            return;
        }
        this._state = this._state.map(state => state.mov(forward));
        const newSelections = this._state.map(state => Selection.fromPositions(state.ranges[state.index].getStartPosition(), state.ranges[state.index].getEndPosition()));
        this._ignoreSelection = true;
        try {
            this._editor.setSelections(newSelections);
        }
        finally {
            this._ignoreSelection = false;
        }
    }
};
SmartSelectController = SmartSelectController_1 = __decorate([
    __param(1, ILanguageFeaturesService)
], SmartSelectController);
export { SmartSelectController };
class AbstractSmartSelect extends EditorAction {
    constructor(forward, opts) {
        super(opts);
        this._forward = forward;
    }
    async run(_accessor, editor) {
        const controller = SmartSelectController.get(editor);
        if (controller) {
            await controller.run(this._forward);
        }
    }
}
class GrowSelectionAction extends AbstractSmartSelect {
    constructor() {
        super(true, {
            id: 'editor.action.smartSelect.expand',
            label: nls.localize2('smartSelect.expand', "Expand Selection"),
            precondition: undefined,
            kbOpts: {
                kbExpr: EditorContextKeys.editorTextFocus,
                primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */,
                    secondary: [256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */],
                },
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menuOpts: {
                menuId: MenuId.MenubarSelectionMenu,
                group: '1_basic',
                title: nls.localize({ key: 'miSmartSelectGrow', comment: ['&& denotes a mnemonic'] }, "&&Expand Selection"),
                order: 2
            }
        });
    }
}
// renamed command id
CommandsRegistry.registerCommandAlias('editor.action.smartSelect.grow', 'editor.action.smartSelect.expand');
class ShrinkSelectionAction extends AbstractSmartSelect {
    constructor() {
        super(false, {
            id: 'editor.action.smartSelect.shrink',
            label: nls.localize2('smartSelect.shrink', "Shrink Selection"),
            precondition: undefined,
            kbOpts: {
                kbExpr: EditorContextKeys.editorTextFocus,
                primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */,
                    secondary: [256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */],
                },
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menuOpts: {
                menuId: MenuId.MenubarSelectionMenu,
                group: '1_basic',
                title: nls.localize({ key: 'miSmartSelectShrink', comment: ['&& denotes a mnemonic'] }, "&&Shrink Selection"),
                order: 3
            }
        });
    }
}
registerEditorContribution(SmartSelectController.ID, SmartSelectController, 4 /* EditorContributionInstantiation.Lazy */);
registerEditorAction(GrowSelectionAction);
registerEditorAction(ShrinkSelectionAction);
export async function provideSelectionRanges(registry, model, positions, options, token) {
    const providers = registry.all(model)
        .concat(new WordSelectionRangeProvider(options.selectSubwords)); // ALWAYS have word based selection range
    if (providers.length === 1) {
        // add word selection and bracket selection when no provider exists
        providers.unshift(new BracketSelectionRangeProvider());
    }
    const work = [];
    const allRawRanges = [];
    for (const provider of providers) {
        work.push(Promise.resolve(provider.provideSelectionRanges(model, positions, token)).then(allProviderRanges => {
            if (arrays.isNonEmptyArray(allProviderRanges) && allProviderRanges.length === positions.length) {
                for (let i = 0; i < positions.length; i++) {
                    if (!allRawRanges[i]) {
                        allRawRanges[i] = [];
                    }
                    for (const oneProviderRanges of allProviderRanges[i]) {
                        if (Range.isIRange(oneProviderRanges.range) && Range.containsPosition(oneProviderRanges.range, positions[i])) {
                            allRawRanges[i].push(Range.lift(oneProviderRanges.range));
                        }
                    }
                }
            }
        }, onUnexpectedExternalError));
    }
    await Promise.all(work);
    return allRawRanges.map(oneRawRanges => {
        if (oneRawRanges.length === 0) {
            return [];
        }
        // sort all by start/end position
        oneRawRanges.sort((a, b) => {
            if (Position.isBefore(a.getStartPosition(), b.getStartPosition())) {
                return 1;
            }
            else if (Position.isBefore(b.getStartPosition(), a.getStartPosition())) {
                return -1;
            }
            else if (Position.isBefore(a.getEndPosition(), b.getEndPosition())) {
                return -1;
            }
            else if (Position.isBefore(b.getEndPosition(), a.getEndPosition())) {
                return 1;
            }
            else {
                return 0;
            }
        });
        // remove ranges that don't contain the former range or that are equal to the
        // former range
        const oneRanges = [];
        let last;
        for (const range of oneRawRanges) {
            if (!last || (Range.containsRange(range, last) && !Range.equalsRange(range, last))) {
                oneRanges.push(range);
                last = range;
            }
        }
        if (!options.selectLeadingAndTrailingWhitespace) {
            return oneRanges;
        }
        // add ranges that expand trivia at line starts and ends whenever a range
        // wraps onto the a new line
        const oneRangesWithTrivia = [oneRanges[0]];
        for (let i = 1; i < oneRanges.length; i++) {
            const prev = oneRanges[i - 1];
            const cur = oneRanges[i];
            if (cur.startLineNumber !== prev.startLineNumber || cur.endLineNumber !== prev.endLineNumber) {
                // add line/block range without leading/failing whitespace
                const rangeNoWhitespace = new Range(prev.startLineNumber, model.getLineFirstNonWhitespaceColumn(prev.startLineNumber), prev.endLineNumber, model.getLineLastNonWhitespaceColumn(prev.endLineNumber));
                if (rangeNoWhitespace.containsRange(prev) && !rangeNoWhitespace.equalsRange(prev) && cur.containsRange(rangeNoWhitespace) && !cur.equalsRange(rangeNoWhitespace)) {
                    oneRangesWithTrivia.push(rangeNoWhitespace);
                }
                // add line/block range
                const rangeFull = new Range(prev.startLineNumber, 1, prev.endLineNumber, model.getLineMaxColumn(prev.endLineNumber));
                if (rangeFull.containsRange(prev) && !rangeFull.equalsRange(rangeNoWhitespace) && cur.containsRange(rangeFull) && !cur.equalsRange(rangeFull)) {
                    oneRangesWithTrivia.push(rangeFull);
                }
            }
            oneRangesWithTrivia.push(cur);
        }
        return oneRangesWithTrivia;
    });
}
CommandsRegistry.registerCommand('_executeSelectionRangeProvider', async function (accessor, ...args) {
    const [resource, positions] = args;
    assertType(URI.isUri(resource));
    assertType(isArrayOf(positions, p => Position.isIPosition(p)));
    const registry = accessor.get(ILanguageFeaturesService).selectionRangeProvider;
    const reference = await accessor.get(ITextModelService).createModelReference(resource);
    try {
        return provideSelectionRanges(registry, reference.object.textEditorModel, positions.map(Position.lift), { selectLeadingAndTrailingWhitespace: true, selectSubwords: true }, CancellationToken.None);
    }
    finally {
        reference.dispose();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic21hcnRTZWxlY3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvc21hcnRTZWxlY3QvYnJvd3Nlci9zbWFydFNlbGVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUk5RSxPQUFPLEVBQUUsWUFBWSxFQUFtRCxvQkFBb0IsRUFBRSwwQkFBMEIsRUFBb0IsTUFBTSxzQ0FBc0MsQ0FBQztBQUV6TCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUU5RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUd6RSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRSxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVwRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV4RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNoRixPQUFPLEVBQUUsVUFBVSxFQUFF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