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
var RenderedContentHover_1, RenderedContentHoverParts_1;
import { RenderedHoverParts } from './hoverTypes.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { EditorHoverStatusBar } from './contentHoverStatusBar.js';
import { HoverCopyButton } from './hoverCopyButton.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import * as dom from '../../../../base/browser/dom.js';
import { MarkdownHoverParticipant } from './markdownHoverParticipant.js';
import { HoverColorPickerParticipant } from '../../colorPicker/browser/hoverColorPicker/hoverColorPickerParticipant.js';
import { localize } from '../../../../nls.js';
import { InlayHintsHover } from '../../inlayHints/browser/inlayHintsHover.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { MarkerHover } from './markerHoverParticipant.js';
let RenderedContentHover = RenderedContentHover_1 = class RenderedContentHover extends Disposable {
    constructor(editor, hoverResult, participants, context, keybindingService, hoverService, clipboardService) {
        super();
        const parts = hoverResult.hoverParts;
        this._renderedHoverParts = this._register(new RenderedContentHoverParts(editor, participants, parts, context, keybindingService, hoverService, clipboardService));
        const contentHoverComputerOptions = hoverResult.options;
        const anchor = contentHoverComputerOptions.anchor;
        const { showAtPosition, showAtSecondaryPosition } = RenderedContentHover_1.computeHoverPositions(editor, anchor.range, parts);
        this.shouldAppearBeforeContent = parts.some(m => m.isBeforeContent);
        this.showAtPosition = showAtPosition;
        this.showAtSecondaryPosition = showAtSecondaryPosition;
        this.initialMousePosX = anchor.initialMousePosX;
        this.initialMousePosY = anchor.initialMousePosY;
        this.shouldFocus = contentHoverComputerOptions.shouldFocus;
        this.source = contentHoverComputerOptions.source;
    }
    get domNode() {
        return this._renderedHoverParts.domNode;
    }
    get domNodeHasChildren() {
        return this._renderedHoverParts.domNodeHasChildren;
    }
    get focusedHoverPartIndex() {
        return this._renderedHoverParts.focusedHoverPartIndex;
    }
    get hoverPartsCount() {
        return this._renderedHoverParts.hoverPartsCount;
    }
    focusHoverPartWithIndex(index) {
        this._renderedHoverParts.focusHoverPartWithIndex(index);
    }
    getAccessibleWidgetContent() {
        return this._renderedHoverParts.getAccessibleContent();
    }
    getAccessibleWidgetContentAtIndex(index) {
        return this._renderedHoverParts.getAccessibleHoverContentAtIndex(index);
    }
    async updateHoverVerbosityLevel(action, index, focus) {
        this._renderedHoverParts.updateHoverVerbosityLevel(action, index, focus);
    }
    doesHoverAtIndexSupportVerbosityAction(index, action) {
        return this._renderedHoverParts.doesHoverAtIndexSupportVerbosityAction(index, action);
    }
    isColorPickerVisible() {
        return this._renderedHoverParts.isColorPickerVisible();
    }
    static computeHoverPositions(editor, anchorRange, hoverParts) {
        let startColumnBoundary = 1;
        if (editor.hasModel()) {
            // Ensure the range is on the current view line
            const viewModel = editor._getViewModel();
            const coordinatesConverter = viewModel.coordinatesConverter;
            const anchorViewRange = coordinatesConverter.convertModelRangeToViewRange(anchorRange);
            const anchorViewMinColumn = viewModel.getLineMinColumn(anchorViewRange.startLineNumber);
            const anchorViewRangeStart = new Position(anchorViewRange.startLineNumber, anchorViewMinColumn);
            startColumnBoundary = coordinatesConverter.convertViewPositionToModelPosition(anchorViewRangeStart).column;
        }
        // The anchor range is always on a single line
        const anchorStartLineNumber = anchorRange.startLineNumber;
        let secondaryPositionColumn = anchorRange.startColumn;
        let forceShowAtRange;
        for (const hoverPart of hoverParts) {
            const hoverPartRange = hoverPart.range;
            const hoverPartRangeOnAnchorStartLine = hoverPartRange.startLineNumber === anchorStartLineNumber;
            const hoverPartRangeOnAnchorEndLine = hoverPartRange.endLineNumber === anchorStartLineNumber;
            const hoverPartRangeIsOnAnchorLine = hoverPartRangeOnAnchorStartLine && hoverPartRangeOnAnchorEndLine;
            if (hoverPartRangeIsOnAnchorLine) {
                // this message has a range that is completely sitting on the line of the anchor
                const hoverPartStartColumn = hoverPartRange.startColumn;
                const minSecondaryPositionColumn = Math.min(secondaryPositionColumn, hoverPartStartColumn);
                secondaryPositionColumn = Math.max(minSecondaryPositionColumn, startColumnBoundary);
            }
            if (hoverPart.forceShowAtRange) {
                forceShowAtRange = hoverPartRange;
            }
        }
        let showAtPosition;
        let showAtSecondaryPosition;
        if (forceShowAtRange) {
            const forceShowAtPosition = forceShowAtRange.getStartPosition();
            showAtPosition = forceShowAtPosition;
            showAtSecondaryPosition = forceShowAtPosition;
        }
        else {
            showAtPosition = anchorRange.getStartPosition();
            showAtSecondaryPosition = new Position(anchorStartLineNumber, secondaryPositionColumn);
        }
        return {
            showAtPosition,
            showAtSecondaryPosition,
        };
    }
};
RenderedContentHover = RenderedContentHover_1 = __decorate([
    __param(4, IKeybindingService),
    __param(5, IHoverService),
    __param(6, IClipboardService)
], RenderedContentHover);
export { RenderedContentHover };
class RenderedStatusBar {
    constructor(fragment, _statusBar) {
        this._statusBar = _statusBar;
        fragment.appendChild(this._statusBar.hoverElement);
    }
    get hoverElement() {
        return this._statusBar.hoverElement;
    }
    get actions() {
        return this._statusBar.actions;
    }
    dispose() {
        this._statusBar.dispose();
    }
}
let RenderedContentHoverParts = class RenderedContentHoverParts extends Disposable {
    static { RenderedContentHoverParts_1 = this; }
    static { this._DECORATION_OPTIONS = ModelDecorationOptions.register({
        description: 'content-hover-highlight',
        className: 'hoverHighlight'
    }); }
    constructor(editor, participants, hoverParts, context, keybindingService, _hoverService, _clipboardService) {
        super();
        this._hoverService = _hoverService;
        this._clipboardService = _clipboardService;
        this._renderedParts = [];
        this._focusedHoverPartIndex = -1;
        this._context = context;
        this._fragment = document.createDocumentFragment();
        this._register(this._renderParts(participants, hoverParts, context, keybindingService, this._hoverService));
        this._register(this._registerListenersOnRenderedParts());
        this._register(this._createEditorDecorations(editor, hoverParts));
        this._updateMarkdownAndColorParticipantInfo(participants);
    }
    _createEditorDecorations(editor, hoverParts) {
        if (hoverParts.length === 0) {
            return Disposable.None;
        }
        let highlightRange = hoverParts[0].range;
        for (const hoverPart of hoverParts) {
            const hoverPartRange = hoverPart.range;
            highlightRange = Range.plusRange(highlightRange, hoverPartRange);
        }
        const highlightDecoration = editor.createDecorationsCollection();
        highlightDecoration.set([{
                range: highlightRange,
                options: RenderedContentHoverParts_1._DECORATION_OPTIONS
            }]);
        return toDisposable(() => {
            highlightDecoration.clear();
        });
    }
    _renderParts(participants, hoverParts, hoverContext, keybindingService, hoverService) {
        const statusBar = new EditorHoverStatusBar(keybindingService, hoverService);
        const hoverRenderingContext = {
            fragment: this._fragment,
            statusBar,
            ...hoverContext
        };
        const disposables = new DisposableStore();
        disposables.add(statusBar);
        for (const participant of participants) {
            const renderedHoverParts = this._renderHoverPartsForParticipant(hoverParts, participant, hoverRenderingContext);
            disposables.add(renderedHoverParts);
            for (const renderedHoverPart of renderedHoverParts.renderedHoverParts) {
                this._renderedParts.push({
                    type: 'hoverPart',
                    participant,
                    hoverPart: renderedHoverPart.hoverPart,
                    hoverElement: renderedHoverPart.hoverElement,
                });
            }
        }
        const renderedStatusBar = this._renderStatusBar(this._fragment, statusBar);
        if (renderedStatusBar) {
            disposables.add(renderedStatusBar);
            this._renderedParts.push({
                type: 'statusBar',
                hoverElement: renderedStatusBar.hoverElement,
                actions: renderedStatusBar.actions,
            });
        }
        return disposables;
    }
    _renderHoverPartsForParticipant(hoverParts, participant, hoverRenderingContext) {
        const hoverPartsForParticipant = hoverParts.filter(hoverPart => hoverPart.owner === participant);
        const hasHoverPartsForParticipant = hoverPartsForParticipant.length > 0;
        if (!hasHoverPartsForParticipant) {
            return new RenderedHoverParts([]);
        }
        return participant.renderHoverParts(hoverRenderingContext, hoverPartsForParticipant);
    }
    _renderStatusBar(fragment, statusBar) {
        if (!statusBar.hasContent) {
            return undefined;
        }
        return new RenderedStatusBar(fragment, statusBar);
    }
    _registerListenersOnRenderedParts() {
        const disposables = new DisposableStore();
        this._renderedParts.forEach((renderedPart, index) => {
            const element = renderedPart.hoverElement;
            element.tabIndex = 0;
            disposables.add(dom.addDisposableListener(element, dom.EventType.FOCUS_IN, (event) => {
                event.stopPropagation();
                this._focusedHoverPartIndex = index;
            }));
            disposables.add(dom.addDisposableListener(element, dom.EventType.FOCUS_OUT, (event) => {
                event.stopPropagation();
                this._focusedHoverPartIndex = -1;
            }));
            // Add copy button for marker hovers
            if (renderedPart.type === 'hoverPart' && renderedPart.hoverPart instanceof MarkerHover) {
                disposables.add(new HoverCopyButton(element, () => renderedPart.participant.getAccessibleContent(renderedPart.hoverPart), this._clipboardService, this._hoverService));
            }
        });
        return disposables;
    }
    _updateMarkdownAndColorParticipantInfo(participants) {
        const markdownHoverParticipant = participants.find(p => {
            return (p instanceof MarkdownHoverParticipant) && !(p instanceof InlayHintsHover);
        });
        if (markdownHoverParticipant) {
            this._markdownHoverParticipant = markdownHoverParticipant;
        }
        this._colorHoverParticipant = participants.find(p => p instanceof HoverColorPickerParticipant);
    }
    focusHoverPartWithIndex(index) {
        if (index < 0 || index >= this._renderedParts.length) {
            return;
        }
        this._renderedParts[index].hoverElement.focus();
    }
    getAccessibleContent() {
        const content = [];
        for (let i = 0; i < this._renderedParts.length; i++) {
            content.push(this.getAccessibleHoverContentAtIndex(i));
        }
        return content.join('\n\n');
    }
    getAccessibleHoverContentAtIndex(index) {
        const renderedPart = this._renderedParts[index];
        if (!renderedPart) {
            return '';
        }
        if (renderedPart.type === 'statusBar') {
            const statusBarDescription = [localize('hoverAccessibilityStatusBar', "This is a hover status bar.")];
            for (const action of renderedPart.actions) {
                const keybinding = action.actionKeybindingLabel;
                if (keybinding) {
                    statusBarDescription.push(localize('hoverAccessibilityStatusBarActionWithKeybinding', "It has an action with label {0} and keybinding {1}.", action.actionLabel, keybinding));
                }
                else {
                    statusBarDescription.push(localize('hoverAccessibilityStatusBarActionWithoutKeybinding', "It has an action with label {0}.", action.actionLabel));
                }
            }
            return statusBarDescription.join('\n');
        }
        return renderedPart.participant.getAccessibleContent(renderedPart.hoverPart);
    }
    async updateHoverVerbosityLevel(action, index, focus) {
        if (!this._markdownHoverParticipant) {
            return;
        }
        let rangeOfIndicesToUpdate;
        if (index >= 0) {
            rangeOfIndicesToUpdate = { start: index, endExclusive: index + 1 };
        }
        else {
            rangeOfIndicesToUpdate = this._findRangeOfMarkdownHoverParts(this._markdownHoverParticipant);
        }
        for (let i = rangeOfIndicesToUpdate.start; i < rangeOfIndicesToUpdate.endExclusive; i++) {
            const normalizedMarkdownHoverIndex = this._normalizedIndexToMarkdownHoverIndexRange(this._markdownHoverParticipant, i);
            if (normalizedMarkdownHoverIndex === undefined) {
                continue;
            }
            const renderedPart = await this._markdownHoverParticipant.updateMarkdownHoverVerbosityLevel(action, normalizedMarkdownHoverIndex);
            if (!renderedPart) {
                continue;
            }
            this._renderedParts[i] = {
                type: 'hoverPart',
                participant: this._markdownHoverParticipant,
                hoverPart: renderedPart.hoverPart,
                hoverElement: renderedPart.hoverElement,
            };
        }
        if (focus) {
            if (index >= 0) {
                this.focusHoverPartWithIndex(index);
            }
            else {
                this._context.focus();
            }
        }
        this._context.onContentsChanged();
    }
    doesHoverAtIndexSupportVerbosityAction(index, action) {
        if (!this._markdownHoverParticipant) {
            return false;
        }
        const normalizedMarkdownHoverIndex = this._normalizedIndexToMarkdownHoverIndexRange(this._markdownHoverParticipant, index);
        if (normalizedMarkdownHoverIndex === undefined) {
            return false;
        }
        return this._markdownHoverParticipant.doesMarkdownHoverAtIndexSupportVerbosityAction(normalizedMarkdownHoverIndex, action);
    }
    isColorPickerVisible() {
        return this._colorHoverParticipant?.isColorPickerVisible() ?? false;
    }
    _normalizedIndexToMarkdownHoverIndexRange(markdownHoverParticipant, index) {
        const renderedPart = this._renderedParts[index];
        if (!renderedPart || renderedPart.type !== 'hoverPart') {
            return undefined;
        }
        const isHoverPartMarkdownHover = renderedPart.participant === markdownHoverParticipant;
        if (!isHoverPartMarkdownHover) {
            return undefined;
        }
        const firstIndexOfMarkdownHovers = this._renderedParts.findIndex(renderedPart => renderedPart.type === 'hoverPart'
            && renderedPart.participant === markdownHoverParticipant);
        if (firstIndexOfMarkdownHovers === -1) {
            throw new BugIndicatingError();
        }
        return index - firstIndexOfMarkdownHovers;
    }
    _findRangeOfMarkdownHoverParts(markdownHoverParticipant) {
        const copiedRenderedParts = this._renderedParts.slice();
        const firstIndexOfMarkdownHovers = copiedRenderedParts.findIndex(renderedPart => renderedPart.type === 'hoverPart' && renderedPart.participant === markdownHoverParticipant);
        const inversedLastIndexOfMarkdownHovers = copiedRenderedParts.reverse().findIndex(renderedPart => renderedPart.type === 'hoverPart' && renderedPart.participant === markdownHoverParticipant);
        const lastIndexOfMarkdownHovers = inversedLastIndexOfMarkdownHovers >= 0 ? copiedRenderedParts.length - inversedLastIndexOfMarkdownHovers : inversedLastIndexOfMarkdownHovers;
        return { start: firstIndexOfMarkdownHovers, endExclusive: lastIndexOfMarkdownHovers + 1 };
    }
    get domNode() {
        return this._fragment;
    }
    get domNodeHasChildren() {
        return this._fragment.hasChildNodes();
    }
    get focusedHoverPartIndex() {
        return this._focusedHoverPartIndex;
    }
    get hoverPartsCount() {
        return this._renderedParts.length;
    }
};
RenderedContentHoverParts = RenderedContentHoverParts_1 = __decorate([
    __param(4, IKeybindingService),
    __param(5, IHoverService),
    __param(6, IClipboardService)
], RenderedContentHoverParts);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudEhvdmVyUmVuZGVyZWQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9jb250ZW50SG92ZXJSZW5kZXJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUE0RyxrQkFBa0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQy9KLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRWxFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUU1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRXRELE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFFdkQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDekUsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sMkVBQTJFLENBQUM7QUFDeEgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFNUUsT0FBTyxFQUFF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