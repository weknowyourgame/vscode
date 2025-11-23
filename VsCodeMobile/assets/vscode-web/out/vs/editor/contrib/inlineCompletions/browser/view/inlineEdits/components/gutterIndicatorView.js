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
import { n, trackFocus } from '../../../../../../../base/browser/dom.js';
import { renderIcon } from '../../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../../../../base/common/codicons.js';
import { BugIndicatingError } from '../../../../../../../base/common/errors.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../../../base/common/lifecycle.js';
import { autorun, constObservable, debouncedObservable, derived, observableFromEvent, observableValue, runOnChange } from '../../../../../../../base/common/observable.js';
import { IAccessibilityService } from '../../../../../../../platform/accessibility/common/accessibility.js';
import { IHoverService } from '../../../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { Point } from '../../../../../../common/core/2d/point.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { StickyScrollController } from '../../../../../stickyScroll/browser/stickyScrollController.js';
import { InlineEditTabAction } from '../inlineEditsViewInterface.js';
import { getEditorBlendedColor, inlineEditIndicatorBackground, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorPrimaryBorder, inlineEditIndicatorPrimaryForeground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorSecondaryBorder, inlineEditIndicatorSecondaryForeground, inlineEditIndicatorsuccessfulBackground, inlineEditIndicatorsuccessfulBorder, inlineEditIndicatorsuccessfulForeground } from '../theme.js';
import { mapOutFalsy, rectToProps } from '../utils/utils.js';
import { GutterIndicatorMenuContent } from './gutterIndicatorMenu.js';
import { assertNever } from '../../../../../../../base/common/assert.js';
import { localize } from '../../../../../../../nls.js';
export class InlineEditsGutterIndicatorData {
    constructor(gutterMenuData, originalRange, model) {
        this.gutterMenuData = gutterMenuData;
        this.originalRange = originalRange;
        this.model = model;
    }
}
export class InlineSuggestionGutterMenuData {
    static fromInlineSuggestion(suggestion) {
        return new InlineSuggestionGutterMenuData(suggestion.action, suggestion.source.provider.displayName ?? localize('inlineSuggestion', "Inline Suggestion"), suggestion.source.inlineSuggestions.commands ?? []);
    }
    constructor(action, displayName, extensionCommands) {
        this.action = action;
        this.displayName = displayName;
        this.extensionCommands = extensionCommands;
    }
}
// TODO this class does not make that much sense yet.
export class SimpleInlineSuggestModel {
    static fromInlineCompletionModel(model) {
        return new SimpleInlineSuggestModel(() => model.accept(), () => model.jump());
    }
    constructor(accept, jump) {
        this.accept = accept;
        this.jump = jump;
    }
}
let InlineEditsGutterIndicator = class InlineEditsGutterIndicator extends Disposable {
    constructor(_editorObs, _data, _tabAction, _verticalOffset, _isHoveringOverInlineEdit, _focusIsInMenu, _hoverService, _instantiationService, _accessibilityService, _themeService) {
        super();
        this._editorObs = _editorObs;
        this._data = _data;
        this._tabAction = _tabAction;
        this._verticalOffset = _verticalOffset;
        this._isHoveringOverInlineEdit = _isHoveringOverInlineEdit;
        this._focusIsInMenu = _focusIsInMenu;
        this._hoverService = _hoverService;
        this._instantiationService = _instantiationService;
        this._accessibilityService = _accessibilityService;
        this._themeService = _themeService;
        this._gutterIndicatorStyles = derived(this, reader => {
            const v = this._tabAction.read(reader);
            switch (v) {
                case InlineEditTabAction.Inactive: return {
                    background: getEditorBlendedColor(inlineEditIndicatorSecondaryBackground, this._themeService).read(reader).toString(),
                    foreground: getEditorBlendedColor(inlineEditIndicatorSecondaryForeground, this._themeService).read(reader).toString(),
                    border: getEditorBlendedColor(inlineEditIndicatorSecondaryBorder, this._themeService).read(reader).toString(),
                };
                case InlineEditTabAction.Jump: return {
                    background: getEditorBlendedColor(inlineEditIndicatorPrimaryBackground, this._themeService).read(reader).toString(),
                    foreground: getEditorBlendedColor(inlineEditIndicatorPrimaryForeground, this._themeService).read(reader).toString(),
                    border: getEditorBlendedColor(inlineEditIndicatorPrimaryBorder, this._themeService).read(reader).toString()
                };
                case InlineEditTabAction.Accept: return {
                    background: getEditorBlendedColor(inlineEditIndicatorsuccessfulBackground, this._themeService).read(reader).toString(),
                    foreground: getEditorBlendedColor(inlineEditIndicatorsuccessfulForeground, this._themeService).read(reader).toString(),
                    border: getEditorBlendedColor(inlineEditIndicatorsuccessfulBorder, this._themeService).read(reader).toString()
                };
                default:
                    assertNever(v);
            }
        });
        this._state = derived(this, reader => {
            const range = this._originalRangeObs.read(reader);
            if (!range) {
                return undefined;
            }
            return {
                range,
                lineOffsetRange: this._editorObs.observeLineOffsetRange(range, reader.store),
            };
        });
        this._lineNumberToRender = derived(this, reader => {
            if (this._verticalOffset.read(reader) !== 0) {
                return '';
            }
            const lineNumber = this._data.read(reader)?.originalRange.startLineNumber;
            const lineNumberOptions = this._editorObs.getOption(76 /* EditorOption.lineNumbers */).read(reader);
            if (lineNumber === undefined || lineNumberOptions.renderType === 0 /* RenderLineNumbersType.Off */) {
                return '';
            }
            if (lineNumberOptions.renderType === 3 /* RenderLineNumbersType.Interval */) {
                const cursorPosition = this._editorObs.cursorPosition.read(reader);
                if (lineNumber % 10 === 0 || cursorPosition && cursorPosition.lineNumber === lineNumber) {
                    return lineNumber.toString();
                }
                return '';
            }
            if (lineNumberOptions.renderType === 2 /* RenderLineNumbersType.Relative */) {
                const cursorPosition = this._editorObs.cursorPosition.read(reader);
                if (!cursorPosition) {
                    return '';
                }
                const relativeLineNumber = Math.abs(lineNumber - cursorPosition.lineNumber);
                if (relativeLineNumber === 0) {
                    return lineNumber.toString();
                }
                return relativeLineNumber.toString();
            }
            if (lineNumberOptions.renderType === 4 /* RenderLineNumbersType.Custom */) {
                if (lineNumberOptions.renderFn) {
                    return lineNumberOptions.renderFn(lineNumber);
                }
                return '';
            }
            return lineNumber.toString();
        });
        this._availableWidthForIcon = derived(this, reader => {
            const textModel = this._editorObs.editor.getModel();
            const editor = this._editorObs.editor;
            const layout = this._editorObs.layoutInfo.read(reader);
            const gutterWidth = layout.decorationsLeft + layout.decorationsWidth - layout.glyphMarginLeft;
            if (!textModel || gutterWidth <= 0) {
                return () => 0;
            }
            // no glyph margin => the entire gutter width is available as there is no optimal place to put the icon
            if (layout.lineNumbersLeft === 0) {
                return () => gutterWidth;
            }
            const lineNumberOptions = this._editorObs.getOption(76 /* EditorOption.lineNumbers */).read(reader);
            if (lineNumberOptions.renderType === 2 /* RenderLineNumbersType.Relative */ || /* likely to flicker */
                lineNumberOptions.renderType === 0 /* RenderLineNumbersType.Off */) {
                return () => gutterWidth;
            }
            const w = editor.getOption(59 /* EditorOption.fontInfo */).typicalHalfwidthCharacterWidth;
            const rightOfLineNumber = layout.lineNumbersLeft + layout.lineNumbersWidth;
            const totalLines = textModel.getLineCount();
            const totalLinesDigits = (totalLines + 1 /* 0 based to 1 based*/).toString().length;
            const offsetDigits = [];
            // We only need to pre compute the usable width left of the line number for the first line number with a given digit count
            for (let digits = 1; digits <= totalLinesDigits; digits++) {
                const firstLineNumberWithDigitCount = 10 ** (digits - 1);
                const topOfLineNumber = editor.getTopForLineNumber(firstLineNumberWithDigitCount);
                const digitsWidth = digits * w;
                const usableWidthLeftOfLineNumber = Math.min(gutterWidth, Math.max(0, rightOfLineNumber - digitsWidth - layout.glyphMarginLeft));
                offsetDigits.push({ firstLineNumberWithDigitCount, topOfLineNumber, usableWidthLeftOfLineNumber });
            }
            return (topOffset) => {
                for (let i = offsetDigits.length - 1; i >= 0; i--) {
                    if (topOffset >= offsetDigits[i].topOfLineNumber) {
                        return offsetDigits[i].usableWidthLeftOfLineNumber;
                    }
                }
                throw new BugIndicatingError('Could not find avilable width for icon');
            };
        });
        this._layout = derived(this, reader => {
            const s = this._state.read(reader);
            if (!s) {
                return undefined;
            }
            const layout = this._editorObs.layoutInfo.read(reader);
            const lineHeight = this._editorObs.observeLineHeightForLine(s.range.map(r => r.startLineNumber)).read(reader);
            const gutterViewPortPadding = 2;
            // Entire gutter view from top left to bottom right
            const gutterWidthWithoutPadding = layout.decorationsLeft + layout.decorationsWidth - layout.glyphMarginLeft - 2 * gutterViewPortPadding;
            const gutterHeightWithoutPadding = layout.height - 2 * gutterViewPortPadding;
            const gutterViewPortWithStickyScroll = Rect.fromLeftTopWidthHeight(gutterViewPortPadding, gutterViewPortPadding, gutterWidthWithoutPadding, gutterHeightWithoutPadding);
            const gutterViewPortWithoutStickyScrollWithoutPaddingTop = gutterViewPortWithStickyScroll.withTop(this._stickyScrollHeight.read(reader));
            const gutterViewPortWithoutStickyScroll = gutterViewPortWithStickyScroll.withTop(gutterViewPortWithoutStickyScrollWithoutPaddingTop.top + gutterViewPortPadding);
            // The glyph margin area across all relevant lines
            const verticalEditRange = s.lineOffsetRange.read(reader);
            const gutterEditArea = Rect.fromRanges(OffsetRange.fromTo(gutterViewPortWithoutStickyScroll.left, gutterViewPortWithoutStickyScroll.right), verticalEditRange);
            // The gutter view container (pill)
            const pillHeight = lineHeight;
            const pillOffset = this._verticalOffset.read(reader);
            const pillFullyDockedRect = gutterEditArea.withHeight(pillHeight).translateY(pillOffset);
            const pillIsFullyDocked = gutterViewPortWithoutStickyScrollWithoutPaddingTop.containsRect(pillFullyDockedRect);
            // The icon which will be rendered in the pill
            const iconNoneDocked = this._tabAction.map(action => action === InlineEditTabAction.Accept ? Codicon.keyboardTab : Codicon.arrowRight);
            const iconDocked = derived(this, reader => {
                if (this._isHoveredOverIconDebounced.read(reader) || this._isHoveredOverInlineEditDebounced.read(reader)) {
                    return Codicon.check;
                }
                if (this._tabAction.read(reader) === InlineEditTabAction.Accept) {
                    return Codicon.keyboardTab;
                }
                const cursorLineNumber = this._editorObs.cursorLineNumber.read(reader) ?? 0;
                const editStartLineNumber = s.range.read(reader).startLineNumber;
                return cursorLineNumber <= editStartLineNumber ? Codicon.keyboardTabAbove : Codicon.keyboardTabBelow;
            });
            const idealIconWidth = 22;
            const minimalIconWidth = 16; // codicon size
            const iconWidth = (pillRect) => {
                const availableWidth = this._availableWidthForIcon.read(undefined)(pillRect.bottom + this._editorObs.editor.getScrollTop()) - gutterViewPortPadding;
                return Math.max(Math.min(availableWidth, idealIconWidth), minimalIconWidth);
            };
            if (pillIsFullyDocked) {
                const pillRect = pillFullyDockedRect;
                let lineNumberWidth;
                if (layout.lineNumbersWidth === 0) {
                    lineNumberWidth = Math.min(Math.max(layout.lineNumbersLeft - gutterViewPortWithStickyScroll.left, 0), pillRect.width - idealIconWidth);
                }
                else {
                    lineNumberWidth = Math.max(layout.lineNumbersLeft + layout.lineNumbersWidth - gutterViewPortWithStickyScroll.left, 0);
                }
                const lineNumberRect = pillRect.withWidth(lineNumberWidth);
                const iconWidth = Math.max(Math.min(layout.decorationsWidth, idealIconWidth), minimalIconWidth);
                const iconRect = pillRect.withWidth(iconWidth).translateX(lineNumberWidth);
                return {
                    gutterEditArea,
                    icon: iconDocked,
                    iconDirection: 'right',
                    iconRect,
                    pillRect,
                    lineNumberRect,
                };
            }
            const pillPartiallyDockedPossibleArea = gutterViewPortWithStickyScroll.intersect(gutterEditArea); // The area in which the pill could be partially docked
            const pillIsPartiallyDocked = pillPartiallyDockedPossibleArea && pillPartiallyDockedPossibleArea.height >= pillHeight;
            if (pillIsPartiallyDocked) {
                // pillFullyDockedRect is outside viewport, move it into the viewport under sticky scroll as we prefer the pill to not be on top of the sticky scroll
                // then move it into the possible area which will only cause it to move if it has to be rendered on top of the sticky scroll
                const pillRectMoved = pillFullyDockedRect.moveToBeContainedIn(gutterViewPortWithoutStickyScroll).moveToBeContainedIn(pillPartiallyDockedPossibleArea);
                const pillRect = pillRectMoved.withWidth(iconWidth(pillRectMoved));
                const iconRect = pillRect;
                return {
                    gutterEditArea,
                    icon: iconDocked,
                    iconDirection: 'right',
                    iconRect,
                    pillRect,
                };
            }
            // pillFullyDockedRect is outside viewport, so move it into viewport
            const pillRectMoved = pillFullyDockedRect.moveToBeContainedIn(gutterViewPortWithStickyScroll);
            const pillRect = pillRectMoved.withWidth(iconWidth(pillRectMoved));
            const iconRect = pillRect;
            // docked = pill was already in the viewport
            const iconDirection = pillRect.top < pillFullyDockedRect.top ?
                'top' :
                'bottom';
            return {
                gutterEditArea,
                icon: iconNoneDocked,
                iconDirection,
                iconRect,
                pillRect,
            };
        });
        this._iconRef = n.ref();
        this.isVisible = this._layout.map(l => !!l);
        this._hoverVisible = observableValue(this, false);
        this.isHoverVisible = this._hoverVisible;
        this._isHoveredOverIcon = observableValue(this, false);
        this._isHoveredOverIconDebounced = debouncedObservable(this._isHoveredOverIcon, 100);
        this.isHoveredOverIcon = this._isHoveredOverIconDebounced;
        this._indicator = n.div({
            class: 'inline-edits-view-gutter-indicator',
            onclick: () => {
                const layout = this._layout.get();
                const acceptOnClick = layout?.icon.get() === Codicon.check;
                const data = this._data.get();
                if (!data) {
                    throw new BugIndicatingError('Gutter indicator data not available');
                }
                this._editorObs.editor.focus();
                if (acceptOnClick) {
                    data.model.accept();
                }
                else {
                    data.model.jump();
                }
            },
            tabIndex: 0,
            style: {
                position: 'absolute',
                overflow: 'visible',
            },
        }, mapOutFalsy(this._layout).map(layout => !layout ? [] : [
            n.div({
                style: {
                    position: 'absolute',
                    background: asCssVariable(inlineEditIndicatorBackground),
                    borderRadius: '4px',
                    ...rectToProps(reader => layout.read(reader).gutterEditArea),
                }
            }),
            n.div({
                class: 'icon',
                ref: this._iconRef,
                onmouseenter: () => {
                    // TODO show hover when hovering ghost text etc.
                    this._showHover();
                },
                style: {
                    cursor: 'pointer',
                    zIndex: '20',
                    position: 'absolute',
                    backgroundColor: this._gutterIndicatorStyles.map(v => v.background),
                    // eslint-disable-next-line local/code-no-any-casts
                    ['--vscodeIconForeground']: this._gutterIndicatorStyles.map(v => v.foreground),
                    border: this._gutterIndicatorStyles.map(v => `1px solid ${v.border}`),
                    boxSizing: 'border-box',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    transition: 'background-color 0.2s ease-in-out, width 0.2s ease-in-out',
                    ...rectToProps(reader => layout.read(reader).pillRect),
                }
            }, [
                n.div({
                    className: 'line-number',
                    style: {
                        lineHeight: layout.map(l => l.lineNumberRect ? l.lineNumberRect.height : 0),
                        display: layout.map(l => l.lineNumberRect ? 'flex' : 'none'),
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        width: layout.map(l => l.lineNumberRect ? l.lineNumberRect.width : 0),
                        height: '100%',
                        color: this._gutterIndicatorStyles.map(v => v.foreground),
                    }
                }, this._lineNumberToRender),
                n.div({
                    style: {
                        rotate: layout.map(l => `${getRotationFromDirection(l.iconDirection)}deg`),
                        transition: 'rotate 0.2s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        marginRight: layout.map(l => l.pillRect.width - l.iconRect.width - (l.lineNumberRect?.width ?? 0)),
                        width: layout.map(l => l.iconRect.width),
                    }
                }, [
                    layout.map((l, reader) => renderIcon(l.icon.read(reader))),
                ])
            ]),
        ]));
        this._originalRangeObs = mapOutFalsy(this._data.map(d => d?.originalRange));
        this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
        this._stickyScrollHeight = this._stickyScrollController
            ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight)
            : constObservable(0);
        const indicator = this._indicator.keepUpdated(this._store);
        this._register(this._editorObs.createOverlayWidget({
            domNode: indicator.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: constObservable(0),
        }));
        this._register(this._editorObs.editor.onMouseMove((e) => {
            const state = this._state.get();
            if (state === undefined) {
                return;
            }
            const el = this._iconRef.element;
            const rect = el.getBoundingClientRect();
            const rectangularArea = Rect.fromLeftTopWidthHeight(rect.left, rect.top, rect.width, rect.height);
            const point = new Point(e.event.posx, e.event.posy);
            this._isHoveredOverIcon.set(rectangularArea.containsPoint(point), undefined);
        }));
        this._register(this._editorObs.editor.onDidScrollChange(() => {
            this._isHoveredOverIcon.set(false, undefined);
        }));
        this._isHoveredOverInlineEditDebounced = debouncedObservable(this._isHoveringOverInlineEdit, 100);
        // pulse animation when hovering inline edit
        this._register(runOnChange(this._isHoveredOverInlineEditDebounced, (isHovering) => {
            if (isHovering) {
                this.triggerAnimation();
            }
        }));
        this._register(autorun(reader => {
            indicator.readEffect(reader);
            if (indicator.element) {
                // For the line number
                this._editorObs.editor.applyFontInfo(indicator.element);
            }
        }));
    }
    triggerAnimation() {
        if (this._accessibilityService.isMotionReduced()) {
            return new Animation(null, null).finished;
        }
        // PULSE ANIMATION:
        const animation = this._iconRef.element.animate([
            {
                outline: `2px solid ${this._gutterIndicatorStyles.map(v => v.border).get()}`,
                outlineOffset: '-1px',
                offset: 0
            },
            {
                outline: `2px solid transparent`,
                outlineOffset: '10px',
                offset: 1
            },
        ], { duration: 500 });
        return animation.finished;
    }
    _showHover() {
        if (this._hoverVisible.get()) {
            return;
        }
        const data = this._data.get();
        if (!data) {
            throw new BugIndicatingError('Gutter indicator data not available');
        }
        const disposableStore = new DisposableStore();
        const content = disposableStore.add(this._instantiationService.createInstance(GutterIndicatorMenuContent, this._editorObs, data.gutterMenuData, (focusEditor) => {
            if (focusEditor) {
                this._editorObs.editor.focus();
            }
            h?.dispose();
        }).toDisposableLiveElement());
        const focusTracker = disposableStore.add(trackFocus(content.element));
        disposableStore.add(focusTracker.onDidBlur(() => this._focusIsInMenu.set(false, undefined)));
        disposableStore.add(focusTracker.onDidFocus(() => this._focusIsInMenu.set(true, undefined)));
        disposableStore.add(toDisposable(() => this._focusIsInMenu.set(false, undefined)));
        const h = this._hoverService.showInstantHover({
            target: this._iconRef.element,
            content: content.element,
        });
        if (h) {
            this._hoverVisible.set(true, undefined);
            disposableStore.add(this._editorObs.editor.onDidScrollChange(() => h.dispose()));
            disposableStore.add(h.onDispose(() => {
                this._hoverVisible.set(false, undefined);
                disposableStore.dispose();
            }));
        }
        else {
            disposableStore.dispose();
        }
    }
};
InlineEditsGutterIndicator = __decorate([
    __param(6, IHoverService),
    __param(7, IInstantiationService),
    __param(8, IAccessibilityService),
    __param(9, IThemeService)
], InlineEditsGutterIndicator);
export { InlineEditsGutterIndicator };
function getRotationFromDirection(direction) {
    switch (direction) {
        case 'top': return 90;
        case 'bottom': return -90;
        case 'right': return 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3V0dGVySW5kaWNhdG9yVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvY29tcG9uZW50cy9ndXR0ZXJJbmRpY2F0b3JWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoRixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMxRyxPQUFPLEVBQW9DLE9BQU8sRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM3TSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUM1RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUczRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDBDQUEw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