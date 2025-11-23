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
import { $, getWindow, n } from '../../../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../../../base/browser/mouseEvent.js';
import { Color } from '../../../../../../../base/common/color.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, derivedObservableWithCache, observableFromEvent } from '../../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { editorBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable, asCssVariableWithDefault } from '../../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { EmbeddedCodeEditorWidget } from '../../../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../../../common/core/position.js';
import { Range } from '../../../../../../common/core/range.js';
import { StickyScrollController } from '../../../../../stickyScroll/browser/stickyScrollController.js';
import { InlineCompletionContextKeys } from '../../../controller/inlineCompletionContextKeys.js';
import { getEditorBlendedColor, getModifiedBorderColor, getOriginalBorderColor, modifiedBackgroundColor, originalBackgroundColor } from '../theme.js';
import { PathBuilder, getContentRenderWidth, getOffsetForPos, mapOutFalsy, maxContentWidthInRange } from '../utils/utils.js';
const HORIZONTAL_PADDING = 0;
const VERTICAL_PADDING = 0;
const ENABLE_OVERFLOW = false;
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH = 3;
const BORDER_RADIUS = 4;
const ORIGINAL_END_PADDING = 20;
const MODIFIED_END_PADDING = 12;
let InlineEditsSideBySideView = class InlineEditsSideBySideView extends Disposable {
    // This is an approximation and should be improved by using the real parameters used bellow
    static fitsInsideViewport(editor, textModel, edit, reader) {
        const editorObs = observableCodeEditor(editor);
        const editorWidth = editorObs.layoutInfoWidth.read(reader);
        const editorContentLeft = editorObs.layoutInfoContentLeft.read(reader);
        const editorVerticalScrollbar = editor.getLayoutInfo().verticalScrollbarWidth;
        const minimapWidth = editorObs.layoutInfoMinimap.read(reader).minimapLeft !== 0 ? editorObs.layoutInfoMinimap.read(reader).minimapWidth : 0;
        const maxOriginalContent = maxContentWidthInRange(editorObs, edit.displayRange, undefined /* do not reconsider on each layout info change */);
        const maxModifiedContent = edit.lineEdit.newLines.reduce((max, line) => Math.max(max, getContentRenderWidth(line, editor, textModel)), 0);
        const originalPadding = ORIGINAL_END_PADDING; // padding after last line of original editor
        const modifiedPadding = MODIFIED_END_PADDING + 2 * BORDER_WIDTH; // padding after last line of modified editor
        return maxOriginalContent + maxModifiedContent + originalPadding + modifiedPadding < editorWidth - editorContentLeft - editorVerticalScrollbar - minimapWidth;
    }
    constructor(_editor, _edit, _previewTextModel, _uiState, _tabAction, _instantiationService, _themeService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._previewTextModel = _previewTextModel;
        this._uiState = _uiState;
        this._tabAction = _tabAction;
        this._instantiationService = _instantiationService;
        this._themeService = _themeService;
        this._editorObs = observableCodeEditor(this._editor);
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._display = derived(this, reader => !!this._uiState.read(reader) ? 'block' : 'none');
        this.previewRef = n.ref();
        const separatorWidthObs = this._uiState.map(s => s?.isInDiffEditor ? WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH : WIDGET_SEPARATOR_WIDTH);
        this._editorContainer = n.div({
            class: ['editorContainer'],
            style: { position: 'absolute', overflow: 'hidden', cursor: 'pointer' },
            onmousedown: e => {
                e.preventDefault(); // This prevents that the editor loses focus
            },
            onclick: (e) => {
                this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e));
            }
        }, [
            n.div({ class: 'preview', style: { pointerEvents: 'none' }, ref: this.previewRef }),
        ]).keepUpdated(this._store);
        this.isHovered = this._editorContainer.didMouseMoveDuringHover;
        this.previewEditor = this._register(this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this.previewRef.element, {
            glyphMargin: false,
            lineNumbers: 'off',
            minimap: { enabled: false },
            guides: {
                indentation: false,
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveIndentation: false,
            },
            rulers: [],
            padding: { top: 0, bottom: 0 },
            folding: false,
            selectOnLineNumbers: false,
            selectionHighlight: false,
            columnSelection: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            revealHorizontalRightPadding: 0,
            bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
                handleMouseWheel: false,
            },
            readOnly: true,
            wordWrap: 'off',
            wordWrapOverride1: 'off',
            wordWrapOverride2: 'off',
        }, {
            contextKeyValues: {
                [InlineCompletionContextKeys.inInlineEditsPreviewEditor.key]: true,
            },
            contributions: [],
        }, this._editor));
        this._previewEditorObs = observableCodeEditor(this.previewEditor);
        this._activeViewZones = [];
        this._updatePreviewEditor = derived(this, reader => {
            this._editorContainer.readEffect(reader);
            this._previewEditorObs.model.read(reader); // update when the model is set
            // Setting this here explicitly to make sure that the preview editor is
            // visible when needed, we're also checking that these fields are defined
            // because of the auto run initial
            // Before removing these, verify with a non-monospace font family
            this._display.read(reader);
            if (this._nonOverflowView) {
                this._nonOverflowView.element.style.display = this._display.read(reader);
            }
            const uiState = this._uiState.read(reader);
            const edit = this._edit.read(reader);
            if (!uiState || !edit) {
                return;
            }
            const range = edit.originalLineRange;
            const hiddenAreas = [];
            if (range.startLineNumber > 1) {
                hiddenAreas.push(new Range(1, 1, range.startLineNumber - 1, 1));
            }
            if (range.startLineNumber + uiState.newTextLineCount < this._previewTextModel.getLineCount() + 1) {
                hiddenAreas.push(new Range(range.startLineNumber + uiState.newTextLineCount, 1, this._previewTextModel.getLineCount() + 1, 1));
            }
            this.previewEditor.setHiddenAreas(hiddenAreas, undefined, true);
            // TODO: is this the proper way to handle viewzones?
            const previousViewZones = [...this._activeViewZones];
            this._activeViewZones = [];
            const reducedLinesCount = (range.endLineNumberExclusive - range.startLineNumber) - uiState.newTextLineCount;
            this.previewEditor.changeViewZones((changeAccessor) => {
                previousViewZones.forEach(id => changeAccessor.removeZone(id));
                if (reducedLinesCount > 0) {
                    this._activeViewZones.push(changeAccessor.addZone({
                        afterLineNumber: range.startLineNumber + uiState.newTextLineCount - 1,
                        heightInLines: reducedLinesCount,
                        showInHiddenAreas: true,
                        domNode: $('div.diagonal-fill.inline-edits-view-zone'),
                    }));
                }
            });
        });
        this._previewEditorWidth = derived(this, reader => {
            const edit = this._edit.read(reader);
            if (!edit) {
                return 0;
            }
            this._updatePreviewEditor.read(reader);
            return maxContentWidthInRange(this._previewEditorObs, edit.modifiedLineRange, reader);
        });
        this._cursorPosIfTouchesEdit = derived(this, reader => {
            const cursorPos = this._editorObs.cursorPosition.read(reader);
            const edit = this._edit.read(reader);
            if (!edit || !cursorPos) {
                return undefined;
            }
            return edit.modifiedLineRange.contains(cursorPos.lineNumber) ? cursorPos : undefined;
        });
        this._originalStartPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.startLineNumber, 1) : null;
        });
        this._originalEndPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.endLineNumberExclusive, 1) : null;
        });
        this._originalVerticalStartPosition = this._editorObs.observePosition(this._originalStartPosition, this._store).map(p => p?.y);
        this._originalVerticalEndPosition = this._editorObs.observePosition(this._originalEndPosition, this._store).map(p => p?.y);
        this._originalDisplayRange = this._edit.map(e => e?.displayRange);
        this._editorMaxContentWidthInRange = derived(this, reader => {
            const originalDisplayRange = this._originalDisplayRange.read(reader);
            if (!originalDisplayRange) {
                return constObservable(0);
            }
            this._editorObs.versionId.read(reader);
            // Take the max value that we observed.
            // Reset when either the edit changes or the editor text version.
            return derivedObservableWithCache(this, (reader, lastValue) => {
                const maxWidth = maxContentWidthInRange(this._editorObs, originalDisplayRange, reader);
                return Math.max(maxWidth, lastValue ?? 0);
            });
        }).map((v, r) => v.read(r));
        this._previewEditorLayoutInfo = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return null;
            }
            const state = this._uiState.read(reader);
            if (!state) {
                return null;
            }
            const range = inlineEdit.originalLineRange;
            const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
            const editorContentMaxWidthInRange = this._editorMaxContentWidthInRange.read(reader);
            const editorLayout = this._editorObs.layoutInfo.read(reader);
            const previewContentWidth = this._previewEditorWidth.read(reader);
            const editorContentAreaWidth = editorLayout.contentWidth - editorLayout.verticalScrollbarWidth;
            const editorBoundingClientRect = this._editor.getContainerDomNode().getBoundingClientRect();
            const clientContentAreaRight = editorLayout.contentLeft + editorLayout.contentWidth + editorBoundingClientRect.left;
            const remainingWidthRightOfContent = getWindow(this._editor.getContainerDomNode()).innerWidth - clientContentAreaRight;
            const remainingWidthRightOfEditor = getWindow(this._editor.getContainerDomNode()).innerWidth - editorBoundingClientRect.right;
            const desiredMinimumWidth = Math.min(editorLayout.contentWidth * 0.3, previewContentWidth, 100);
            const IN_EDITOR_DISPLACEMENT = 0;
            const maximumAvailableWidth = IN_EDITOR_DISPLACEMENT + remainingWidthRightOfContent;
            const cursorPos = this._cursorPosIfTouchesEdit.read(reader);
            const maxPreviewEditorLeft = Math.max(
            // We're starting from the content area right and moving it left by IN_EDITOR_DISPLACEMENT and also by an amount to ensure some minimum desired width
            editorContentAreaWidth + horizontalScrollOffset - IN_EDITOR_DISPLACEMENT - Math.max(0, desiredMinimumWidth - maximumAvailableWidth), 
            // But we don't want that the moving left ends up covering the cursor, so this will push it to the right again
            Math.min(cursorPos ? getOffsetForPos(this._editorObs, cursorPos, reader) + 50 : 0, editorContentAreaWidth + horizontalScrollOffset));
            const previewEditorLeftInTextArea = Math.min(editorContentMaxWidthInRange + ORIGINAL_END_PADDING, maxPreviewEditorLeft);
            const maxContentWidth = editorContentMaxWidthInRange + ORIGINAL_END_PADDING + previewContentWidth + 70;
            const dist = maxPreviewEditorLeft - previewEditorLeftInTextArea;
            let desiredPreviewEditorScrollLeft;
            let codeRight;
            if (previewEditorLeftInTextArea > horizontalScrollOffset) {
                desiredPreviewEditorScrollLeft = 0;
                codeRight = editorLayout.contentLeft + previewEditorLeftInTextArea - horizontalScrollOffset;
            }
            else {
                desiredPreviewEditorScrollLeft = horizontalScrollOffset - previewEditorLeftInTextArea;
                codeRight = editorLayout.contentLeft;
            }
            const selectionTop = this._originalVerticalStartPosition.read(reader) ?? this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            const selectionBottom = this._originalVerticalEndPosition.read(reader) ?? this._editor.getBottomForLineNumber(range.endLineNumberExclusive - 1) - this._editorObs.scrollTop.read(reader);
            // TODO: const { prefixLeftOffset } = getPrefixTrim(inlineEdit.edit.edits.map(e => e.range), inlineEdit.originalLineRange, [], this._editor);
            const codeLeft = editorLayout.contentLeft - horizontalScrollOffset;
            let codeRect = Rect.fromLeftTopRightBottom(codeLeft, selectionTop, codeRight, selectionBottom);
            const isInsertion = codeRect.height === 0;
            if (!isInsertion) {
                codeRect = codeRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING);
            }
            const previewLineHeights = this._previewEditorObs.observeLineHeightsForLineRange(inlineEdit.modifiedLineRange).read(reader);
            const editHeight = previewLineHeights.reduce((acc, h) => acc + h, 0);
            const codeHeight = selectionBottom - selectionTop;
            const previewEditorHeight = Math.max(codeHeight, editHeight);
            const clipped = dist === 0;
            const codeEditDist = 0;
            const previewEditorWidth = Math.min(previewContentWidth + MODIFIED_END_PADDING, remainingWidthRightOfEditor + editorLayout.width - editorLayout.contentLeft - codeEditDist);
            let editRect = Rect.fromLeftTopWidthHeight(codeRect.right + codeEditDist, selectionTop, previewEditorWidth, previewEditorHeight);
            if (!isInsertion) {
                editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateX(HORIZONTAL_PADDING + BORDER_WIDTH);
            }
            else {
                // Align top of edit with insertion line
                editRect = editRect.withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING).translateY(VERTICAL_PADDING);
            }
            // debugView(debugLogRects({ codeRect, editRect }, this._editor.getDomNode()!), reader);
            return {
                codeRect,
                editRect,
                codeScrollLeft: horizontalScrollOffset,
                contentLeft: editorLayout.contentLeft,
                isInsertion,
                maxContentWidth,
                shouldShowShadow: clipped,
                desiredPreviewEditorScrollLeft,
                previewEditorWidth,
            };
        });
        this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
        this._stickyScrollHeight = this._stickyScrollController ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight) : constObservable(0);
        this._shouldOverflow = derived(this, reader => {
            if (!ENABLE_OVERFLOW) {
                return false;
            }
            const range = this._edit.read(reader)?.originalLineRange;
            if (!range) {
                return false;
            }
            const stickyScrollHeight = this._stickyScrollHeight.read(reader);
            const top = this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            if (top <= stickyScrollHeight) {
                return false;
            }
            const bottom = this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
            if (bottom >= this._editorObs.layoutInfo.read(reader).height) {
                return false;
            }
            return true;
        });
        this._originalBackgroundColor = observableFromEvent(this, this._themeService.onDidColorThemeChange, () => {
            return this._themeService.getColorTheme().getColor(originalBackgroundColor) ?? Color.transparent;
        });
        this._backgroundSvg = n.svg({
            transform: 'translate(-0.5 -0.5)',
            style: { overflow: 'visible', pointerEvents: 'none', position: 'absolute' },
        }, [
            n.svgElem('path', {
                class: 'rightOfModifiedBackgroundCoverUp',
                d: derived(this, reader => {
                    const layoutInfo = this._previewEditorLayoutInfo.read(reader);
                    if (!layoutInfo) {
                        return undefined;
                    }
                    const originalBackgroundColor = this._originalBackgroundColor.read(reader);
                    if (originalBackgroundColor.isTransparent()) {
                        return undefined;
                    }
                    return new PathBuilder()
                        .moveTo(layoutInfo.codeRect.getRightTop())
                        .lineTo(layoutInfo.codeRect.getRightTop().deltaX(1000))
                        .lineTo(layoutInfo.codeRect.getRightBottom().deltaX(1000))
                        .lineTo(layoutInfo.codeRect.getRightBottom())
                        .build();
                }),
                style: {
                    fill: asCssVariableWithDefault(editorBackground, 'transparent'),
                }
            }),
        ]).keepUpdated(this._store);
        this._originalOverlay = n.div({
            style: { pointerEvents: 'none', display: this._previewEditorLayoutInfo.map(layoutInfo => layoutInfo?.isInsertion ? 'none' : 'block') },
        }, derived(this, reader => {
            const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
            if (!layoutInfoObs) {
                return undefined;
            }
            const separatorWidth = separatorWidthObs.read(reader);
            const borderStyling = getOriginalBorderColor(this._tabAction).map(bc => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`);
            const borderStylingSeparator = `${BORDER_WIDTH + separatorWidth}px solid ${asCssVariable(editorBackground)}`;
            const hasBorderLeft = layoutInfoObs.read(reader).codeScrollLeft !== 0;
            const isModifiedLower = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
            const transitionRectSize = BORDER_RADIUS * 2 + BORDER_WIDTH * 2;
            // Create an overlay which hides the left hand side of the original overlay when it overflows to the left
            // such that there is a smooth transition at the edge of content left
            const overlayHider = layoutInfoObs.map(layoutInfo => Rect.fromLeftTopRightBottom(layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH, layoutInfo.codeRect.top, layoutInfo.contentLeft, layoutInfo.codeRect.bottom + transitionRectSize)).read(reader);
            const intersectionLine = new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER);
            const overlayRect = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.intersectHorizontal(intersectionLine));
            const separatorRect = overlayRect.map(overlayRect => overlayRect.withMargin(separatorWidth, 0, separatorWidth, separatorWidth).intersectHorizontal(intersectionLine));
            const transitionRect = overlayRect.map(overlayRect => Rect.fromLeftTopWidthHeight(overlayRect.right - transitionRectSize + BORDER_WIDTH, overlayRect.bottom - BORDER_WIDTH, transitionRectSize, transitionRectSize).intersectHorizontal(intersectionLine));
            return [
                n.div({
                    class: 'originalSeparatorSideBySide',
                    style: {
                        ...separatorRect.read(reader).toStyles(),
                        boxSizing: 'border-box',
                        borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
                        borderTop: borderStylingSeparator,
                        borderBottom: borderStylingSeparator,
                        borderLeft: hasBorderLeft ? 'none' : borderStylingSeparator,
                    }
                }),
                n.div({
                    class: 'originalOverlaySideBySide',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        boxSizing: 'border-box',
                        borderRadius: `${BORDER_RADIUS}px 0 0 ${BORDER_RADIUS}px`,
                        borderTop: borderStyling,
                        borderBottom: borderStyling,
                        borderLeft: hasBorderLeft ? 'none' : borderStyling,
                        backgroundColor: asCssVariable(originalBackgroundColor),
                    }
                }),
                n.div({
                    class: 'originalCornerCutoutSideBySide',
                    style: {
                        pointerEvents: 'none',
                        display: isModifiedLower.map(isLower => isLower ? 'block' : 'none'),
                        ...transitionRect.read(reader).toStyles(),
                    }
                }, [
                    n.div({
                        class: 'originalCornerCutoutBackground',
                        style: {
                            position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%',
                            backgroundColor: getEditorBlendedColor(originalBackgroundColor, this._themeService).map(c => c.toString()),
                        }
                    }),
                    n.div({
                        class: 'originalCornerCutoutBorder',
                        style: {
                            position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%',
                            boxSizing: 'border-box',
                            borderTop: borderStyling,
                            borderRight: borderStyling,
                            borderRadius: `0 100% 0 0`,
                            backgroundColor: asCssVariable(editorBackground)
                        }
                    })
                ]),
                n.div({
                    class: 'originalOverlaySideBySideHider',
                    style: {
                        ...overlayHider.toStyles(),
                        backgroundColor: asCssVariable(editorBackground),
                    }
                }),
            ];
        })).keepUpdated(this._store);
        this._modifiedOverlay = n.div({
            style: { pointerEvents: 'none', }
        }, derived(this, reader => {
            const layoutInfoObs = mapOutFalsy(this._previewEditorLayoutInfo).read(reader);
            if (!layoutInfoObs) {
                return undefined;
            }
            const isModifiedLower = layoutInfoObs.map(layoutInfo => layoutInfo.codeRect.bottom < layoutInfo.editRect.bottom);
            const separatorWidth = separatorWidthObs.read(reader);
            const borderRadius = isModifiedLower.map(isLower => `0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px ${isLower ? BORDER_RADIUS : 0}px`);
            const borderStyling = getEditorBlendedColor(getModifiedBorderColor(this._tabAction), this._themeService).map(c => `1px solid ${c.toString()}`);
            const borderStylingSeparator = `${BORDER_WIDTH + separatorWidth}px solid ${asCssVariable(editorBackground)}`;
            const overlayRect = layoutInfoObs.map(layoutInfo => layoutInfo.editRect.withMargin(0, BORDER_WIDTH));
            const separatorRect = overlayRect.map(overlayRect => overlayRect.withMargin(separatorWidth, separatorWidth, separatorWidth, 0));
            const insertionRect = derived(this, reader => {
                const overlay = overlayRect.read(reader);
                const layoutinfo = layoutInfoObs.read(reader);
                if (!layoutinfo.isInsertion || layoutinfo.contentLeft >= overlay.left) {
                    return Rect.fromLeftTopWidthHeight(overlay.left, overlay.top, 0, 0);
                }
                return new Rect(layoutinfo.contentLeft, overlay.top, overlay.left, overlay.top + BORDER_WIDTH * 2);
            });
            return [
                n.div({
                    class: 'modifiedInsertionSideBySide',
                    style: {
                        ...insertionRect.read(reader).toStyles(),
                        backgroundColor: getModifiedBorderColor(this._tabAction).map(c => asCssVariable(c)),
                    }
                }),
                n.div({
                    class: 'modifiedSeparatorSideBySide',
                    style: {
                        ...separatorRect.read(reader).toStyles(),
                        borderRadius,
                        borderTop: borderStylingSeparator,
                        borderBottom: borderStylingSeparator,
                        borderRight: borderStylingSeparator,
                        boxSizing: 'border-box',
                    }
                }),
                n.div({
                    class: 'modifiedOverlaySideBySide',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        borderRadius,
                        border: borderStyling,
                        boxSizing: 'border-box',
                        backgroundColor: asCssVariable(modifiedBackgroundColor),
                    }
                })
            ];
        })).keepUpdated(this._store);
        this._nonOverflowView = n.div({
            class: 'inline-edits-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: this._display,
            },
        }, [
            this._backgroundSvg,
            derived(this, reader => this._shouldOverflow.read(reader) ? [] : [this._editorContainer, this._originalOverlay, this._modifiedOverlay]),
        ]).keepUpdated(this._store);
        this._register(this._editorObs.createOverlayWidget({
            domNode: this._nonOverflowView.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: derived(this, reader => {
                const x = this._previewEditorLayoutInfo.read(reader)?.maxContentWidth;
                if (x === undefined) {
                    return 0;
                }
                return x;
            }),
        }));
        this.previewEditor.setModel(this._previewTextModel);
        this._register(autorun(reader => {
            const layoutInfo = this._previewEditorLayoutInfo.read(reader);
            if (!layoutInfo) {
                return;
            }
            const editorRect = layoutInfo.editRect.withMargin(-VERTICAL_PADDING, -HORIZONTAL_PADDING);
            this.previewEditor.layout({ height: editorRect.height, width: layoutInfo.previewEditorWidth + 15 /* Make sure editor does not scroll horizontally */ });
            this._editorContainer.element.style.top = `${editorRect.top}px`;
            this._editorContainer.element.style.left = `${editorRect.left}px`;
            this._editorContainer.element.style.width = `${layoutInfo.previewEditorWidth + HORIZONTAL_PADDING}px`; // Set width to clip view zone
            //this._editorContainer.element.style.borderRadius = `0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px 0`;
        }));
        this._register(autorun(reader => {
            const layoutInfo = this._previewEditorLayoutInfo.read(reader);
            if (!layoutInfo) {
                return;
            }
            this._previewEditorObs.editor.setScrollLeft(layoutInfo.desiredPreviewEditorScrollLeft);
        }));
        this._updatePreviewEditor.recomputeInitiallyAndOnChange(this._store);
    }
};
InlineEditsSideBySideView = __decorate([
    __param(5, IInstantiationService),
    __param(6, IThemeService)
], InlineEditsSideBySideView);
export { InlineEditsSideBySideView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNTaWRlQnlTaWRlVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9pbmxpbmVFZGl0c1NpZGVCeVNpZGVWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNFLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNFLE9BQU8sRUFBd0IsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxSyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUM1RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUMvRixPQUFPLEVBQUUsYUFBYSxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDbkgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTNGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUNuSCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUUvRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUdqRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsc0JBQXNCLEVBQUUsc0JBQXNCLEVBQUUsdUJBQXVCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdEosT0FBTyxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFN0gsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFDN0IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFDM0IsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBRTlCLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQztBQUN2QixNQUFNLHNCQUFzQixHQUFHLENBQUMsQ0FBQztBQUNqQyxNQUFNLGtDQUFrQyxHQUFHLENBQUMsQ0FBQztBQUM3QyxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFDeEIsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUM7QUFDaEMsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUM7QUFFekIsSUFBTSx5QkFBeUIsR0FBL0IsTUFBTSx5QkFBMEIsU0FBUSxVQUFVO0lBRXhELDJGQUEyRjtJQUMzRixNQUFNLENBQUMsa0JBQWtCLENBQUMsTUFBbUIsRUFBRSxTQUFxQixFQUFFLElBQTJCLEVBQUUsTUFBZTtRQUNqSCxNQUFNLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQyxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzRCxNQUFNLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkUsTUFBTSx1QkFBdUIsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsc0JBQXNCLENBQUM7UUFDOUUsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVJLE1BQU0sa0JBQWtCLEdBQUcsc0JBQXNCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFBLGtEQUFrRCxDQUFDLENBQUM7UUFDN0ksTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUksTUFBTSxlQUFlLEdBQUcsb0JBQW9CLENBQUMsQ0FBQyw2Q0FBNkM7UUFDM0YsTUFBTSxlQUFlLEdBQUcsb0JBQW9CLEdBQUcsQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLDZDQUE2QztRQUU5RyxPQUFPLGtCQUFrQixHQUFHLGtCQUFrQixHQUFHLGVBQWUsR0FBRyxlQUFlLEdBQUcsV0FBVyxHQUFHLGlCQUFpQixHQUFHLHVCQUF1QixHQUFHLFlBQVksQ0FBQztJQUMvSixDQUFDO0lBT0QsWUFDa0IsT0FBb0IsRUFDcEIsS0FBcUQsRUFDckQsaUJBQTZCLEVBQzdCLFFBR0gsRUFDRyxVQUE0QyxFQUNyQixxQkFBNEMsRUFDcEQsYUFBNEI7UUFFNUQsS0FBSyxFQUFFLENBQUM7UUFYUyxZQUFPLEdBQVAsT0FBTyxDQUFhO1FBQ3BCLFVBQUssR0FBTCxLQUFLLENBQWdEO1FBQ3JELHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBWTtRQUM3QixhQUFRLEdBQVIsUUFBUSxDQUdYO1FBQ0csZUFBVSxHQUFWLFVBQVUsQ0FBa0M7UUFDckIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUNwRCxrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUc1RCxJQUFJLENBQUMsVUFBVSxHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQWUsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7UUFDekMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBa0IsQ0FBQztRQUMxQyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDbEksSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDN0IsS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUM7WUFDMUIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7WUFDdEUsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFO2dCQUNoQixDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyw0Q0FBNEM7WUFDakUsQ0FBQztZQUNELE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEUsQ0FBQztTQUNELEVBQUU7WUFDRixDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztTQUNuRixDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztRQUMvRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FDNUUsd0JBQXdCLEVBQ3hCLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUN2QjtZQUNDLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7WUFDM0IsTUFBTSxFQUFFO2dCQUNQLFdBQVcsRUFBRSxLQUFLO2dCQUNsQixZQUFZLEVBQUUsS0FBSztnQkFDbkIsc0JBQXNCLEVBQUUsS0FBSztnQkFDN0IsMEJBQTBCLEVBQUUsS0FBSzthQUNqQztZQUNELE1BQU0sRUFBRSxFQUFFO1lBQ1YsT0FBTyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFO1lBQzlCLE9BQU8sRUFBRSxLQUFLO1lBQ2QsbUJBQW1CLEVBQUUsS0FBSztZQUMxQixrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLGVBQWUsRUFBRSxLQUFLO1lBQ3RCLG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsa0JBQWtCLEVBQUUsQ0FBQztZQUNyQixvQkFBb0IsRUFBRSxDQUFDO1lBQ3ZCLG1CQUFtQixFQUFFLENBQUM7WUFDdEIsNEJBQTRCLEVBQUUsQ0FBQztZQUMvQix1QkFBdUIsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsa0NBQWtDLEVBQUUsS0FBSyxFQUFFO1lBQ3JGLG9CQUFvQixFQUFFLEtBQUs7WUFDM0IsU0FBUyxFQUFFO2dCQUNWLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixVQUFVLEVBQUUsUUFBUTtnQkFDcEIsZ0JBQWdCLEVBQUUsS0FBSzthQUN2QjtZQUNELFFBQVEsRUFBRSxJQUFJO1lBQ2QsUUFBUSxFQUFFLEtBQUs7WUFDZixpQkFBaUIsRUFBRSxLQUFLO1lBQ3hCLGlCQUFpQixFQUFFLEtBQUs7U0FDeEIsRUFDRDtZQUNDLGdCQUFnQixFQUFFO2dCQUNqQixDQUFDLDJCQUEyQixDQUFDLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUk7YUFDbEU7WUFDRCxhQUFhLEVBQUUsRUFBRTtTQUNqQixFQUNELElBQUksQ0FBQyxPQUFPLENBQ1osQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGlCQUFpQixHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNsRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQ2xELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQywrQkFBK0I7WUFFMUUsdUVBQXVFO1lBQ3ZFLHlFQUF5RTtZQUN6RSxrQ0FBa0M7WUFDbEMsaUVBQWlFO1lBQ2pFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzNCLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN2QixPQUFPO1lBQ1IsQ0FBQztZQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztZQUVyQyxNQUFNLFdBQVcsR0FBWSxFQUFFLENBQUM7WUFDaEMsSUFBSSxLQUFLLENBQUMsZUFBZSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMvQixXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqRSxDQUFDO1lBQ0QsSUFBSSxLQUFLLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xHLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoSSxDQUFDO1lBRUQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVoRSxvREFBb0Q7WUFDcEQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztZQUUzQixNQUFNLGlCQUFpQixHQUFHLENBQUMsS0FBSyxDQUFDLHNCQUFzQixHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7WUFDNUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxjQUFjLEVBQUUsRUFBRTtnQkFDckQsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUUvRCxJQUFJLGlCQUFpQixHQUFHLENBQUMsRUFBRSxDQUFDO29CQUMzQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7d0JBQ2pELGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDO3dCQUNyRSxhQUFhLEVBQUUsaUJBQWlCO3dCQUNoQyxpQkFBaUIsRUFBRSxJQUFJO3dCQUN2QixPQUFPLEVBQUUsQ0FBQyxDQUFDLDBDQUEwQyxDQUFDO3FCQUN0RCxDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQ2pELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFBQyxPQUFPLENBQUMsQ0FBQztZQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUV2QyxPQUFPLHNCQUFzQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkYsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtZQUNyRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUFDLE9BQU8sU0FBUyxDQUFDO1lBQUMsQ0FBQztZQUM5QyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUN0RixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxzQkFBc0IsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUMxRixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDcEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ2pHLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLDhCQUE4QixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQy9ILElBQUksQ0FBQyw0QkFBNEIsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzSCxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDbEUsSUFBSSxDQUFDLDZCQUE2QixHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUU7WUFDM0QsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JFLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO2dCQUMzQixPQUFPLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixDQUFDO1lBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZDLHVDQUF1QztZQUN2QyxpRUFBaUU7WUFDakUsT0FBTywwQkFBMEIsQ0FBUyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7Z0JBQ3JFLE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZGLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzNDLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVCLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDeEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1osT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLGlCQUFpQixDQUFDO1lBRTNDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZFLE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyRixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDN0QsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xFLE1BQU0sc0JBQXNCLEdBQUcsWUFBWSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUMsc0JBQXNCLENBQUM7WUFDL0YsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM1RixNQUFNLHNCQUFzQixHQUFHLFlBQVksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLFlBQVksR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUM7WUFDcEgsTUFBTSw0QkFBNEIsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsVUFBVSxHQUFHLHNCQUFzQixDQUFDO1lBQ3ZILE1BQU0sMkJBQTJCLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLFVBQVUsR0FBRyx3QkFBd0IsQ0FBQyxLQUFLLENBQUM7WUFDOUgsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxZQUFZLEdBQUcsR0FBRyxFQUFFLG1CQUFtQixFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2hHLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO1lBQ2pDLE1BQU0scUJBQXFCLEdBQUcsc0JBQXNCLEdBQUcsNEJBQTRCLENBQUM7WUFFcEYsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUU1RCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxHQUFHO1lBQ3BDLHFKQUFxSjtZQUNySixzQkFBc0IsR0FBRyxzQkFBc0IsR0FBRyxzQkFBc0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxtQkFBbUIsR0FBRyxxQkFBcUIsQ0FBQztZQUNuSSw4R0FBOEc7WUFDOUcsSUFBSSxDQUFDLEdBQUcsQ0FDUCxTQUFTLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDeEUsc0JBQXNCLEdBQUcsc0JBQXNCLENBQy9DLENBQ0QsQ0FBQztZQUNGLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsR0FBRyxvQkFBb0IsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBRXhILE1BQU0sZUFBZSxHQUFHLDRCQUE0QixHQUFHLG9CQUFvQixHQUFHLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztZQUV2RyxNQUFNLElBQUksR0FBRyxvQkFBb0IsR0FBRywyQkFBMkIsQ0FBQztZQUVoRSxJQUFJLDhCQUE4QixDQUFDO1lBQ25DLElBQUksU0FBUyxDQUFDO1lBQ2QsSUFBSSwyQkFBMkIsR0FBRyxzQkFBc0IsRUFBRSxDQUFDO2dCQUMxRCw4QkFBOEIsR0FBRyxDQUFDLENBQUM7Z0JBQ25DLFNBQVMsR0FBRyxZQUFZLENBQUMsV0FBVyxHQUFHLDJCQUEyQixHQUFHLHNCQUFzQixDQUFDO1lBQzdGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCw4QkFBOEIsR0FBRyxzQkFBc0IsR0FBRywyQkFBMkIsQ0FBQztnQkFDdEYsU0FBUyxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUM7WUFDdEMsQ0FBQztZQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFLLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXpMLDZJQUE2STtZQUM3SSxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxHQUFHLHNCQUFzQixDQUFDO1lBRW5FLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUMvRixNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xCLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDdEUsQ0FBQztZQUVELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLDhCQUE4QixDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1SCxNQUFNLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sVUFBVSxHQUFHLGVBQWUsR0FBRyxZQUFZLENBQUM7WUFDbEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUU3RCxNQUFNLE9BQU8sR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDO1lBQzNCLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQztZQUN2QixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEdBQUcsb0JBQW9CLEVBQUUsMkJBQTJCLEdBQUcsWUFBWSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQyxDQUFDO1lBRTVLLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLFlBQVksRUFBRSxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztZQUNqSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xCLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLGtCQUFrQixHQUFHLFlBQVksQ0FBQyxDQUFDO1lBQ3BILENBQUM7aUJBQU0sQ0FBQztnQkFDUCx3Q0FBd0M7Z0JBQ3hDLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDbkcsQ0FBQztZQUVELHdGQUF3RjtZQUV4RixPQUFPO2dCQUNOLFFBQVE7Z0JBQ1IsUUFBUTtnQkFDUixjQUFjLEVBQUUsc0JBQXNCO2dCQUN0QyxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVc7Z0JBRXJDLFdBQVc7Z0JBQ1gsZUFBZTtnQkFDZixnQkFBZ0IsRUFBRSxPQUFPO2dCQUN6Qiw4QkFBOEI7Z0JBQzlCLGtCQUFrQjthQUNsQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN04sSUFBSSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQzdDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdEIsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsaUJBQWlCLENBQUM7WUFDekQsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNaLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDN0csSUFBSSxHQUFHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkgsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM5RCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLHdCQUF3QixHQUFHLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtZQUN4RyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFFLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUNsRyxDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUMzQixTQUFTLEVBQUUsc0JBQXNCO1lBQ2pDLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFO1NBQzNFLEVBQUU7WUFDRixDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDakIsS0FBSyxFQUFFLGtDQUFrQztnQkFDekMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUU7b0JBQ3pCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzlELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDakIsT0FBTyxTQUFTLENBQUM7b0JBQ2xCLENBQUM7b0JBQ0QsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMzRSxJQUFJLHVCQUF1QixDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUM7d0JBQzdDLE9BQU8sU0FBUyxDQUFDO29CQUNsQixDQUFDO29CQUVELE9BQU8sSUFBSSxXQUFXLEVBQUU7eUJBQ3RCLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDO3lCQUN6QyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7eUJBQ3RELE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzt5QkFDekQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7eUJBQzVDLEtBQUssRUFBRSxDQUFDO2dCQUNYLENBQUMsQ0FBQztnQkFDRixLQUFLLEVBQUU7b0JBQ04sSUFBSSxFQUFFLHdCQUF3QixDQUFDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQztpQkFDL0Q7YUFDRCxDQUFDO1NBQ0YsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDN0IsS0FBSyxFQUFFLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUU7U0FDdEksRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQ3pCLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUFDLE9BQU8sU0FBUyxDQUFDO1lBQUMsQ0FBQztZQUV6QyxNQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEQsTUFBTSxhQUFhLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxZQUFZLGFBQWEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEgsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLFlBQVksR0FBRyxjQUFjLFlBQVksYUFBYSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztZQUU3RyxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLENBQUM7WUFDdEUsTUFBTSxlQUFlLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakgsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLEdBQUcsQ0FBQyxHQUFHLFlBQVksR0FBRyxDQUFDLENBQUM7WUFFaEUseUdBQXlHO1lBQ3pHLHFFQUFxRTtZQUNyRSxNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUMvRSxVQUFVLENBQUMsV0FBVyxHQUFHLGFBQWEsR0FBRyxZQUFZLEVBQ3JELFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUN2QixVQUFVLENBQUMsV0FBVyxFQUN0QixVQUFVLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxrQkFBa0IsQ0FDL0MsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVoQixNQUFNLGdCQUFnQixHQUFHLElBQUksV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDckYsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1lBQy9HLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztZQUV0SyxNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsa0JBQWtCLEdBQUcsWUFBWSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEdBQUcsWUFBWSxFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1lBRTNQLE9BQU87Z0JBQ04sQ0FBQyxDQUFDLEdBQUcsQ0FBQztvQkFDTCxLQUFLLEVBQUUsNkJBQTZCO29CQUNwQyxLQUFLLEVBQUU7d0JBQ04sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRTt3QkFDeEMsU0FBUyxFQUFFLFlBQVk7d0JBQ3ZCLFlBQVksRUFBRSxHQUFHLGFBQWEsVUFBVSxhQUFhLElBQUk7d0JBQ3pELFNBQVMsRUFBRSxzQkFBc0I7d0JBQ2pDLFlBQVksRUFBRSxzQkFBc0I7d0JBQ3BDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsc0JBQXNCO3FCQUMzRDtpQkFDRCxDQUFDO2dCQUVGLENBQUMsQ0FBQyxHQUFHLENBQUM7b0JBQ0wsS0FBSyxFQUFFLDJCQUEyQjtvQkFDbEMsS0FBSyxFQUFFO3dCQUNOLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUU7d0JBQ3RDLFNBQVMsRUFBRSxZQUFZO3dCQUN2QixZQUFZLEVBQUUsR0FBRyxhQUFhLFVBQVUsYUFBYSxJQUFJO3dCQUN6RCxTQUFTLEVBQUUsYUFBYTt3QkFDeEIsWUFBWSxFQUFFLGFBQWE7d0JBQzNCLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsYUFBYTt3QkFDbEQsZUFBZSxFQUFFLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztxQkFDdkQ7aUJBQ0QsQ0FBQztnQkFFRixDQUFDLENBQUMsR0FBRyxDQUFDO29CQUNMLEtBQUssRUFBRSxnQ0FBZ0M7b0JBQ3ZDLEtBQUssRUFBRTt3QkFDTixhQUFhLEVBQUUsTUFBTTt3QkFDckIsT0FBTyxFQUFFLGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO3dCQUNuRSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFO3FCQUN6QztpQkFDRCxFQUFFO29CQUNGLENBQUMsQ0FBQyxHQUFHLENBQUM7d0JBQ0wsS0FBSyxFQUFFLGdDQUFnQzt3QkFDdkMsS0FBSyxFQUFFOzRCQUNOLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU07NEJBQzVFLGVBQWUsRUFBRSxxQkFBcUIsQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO3lCQUMxRztxQkFDRCxDQUFDO29CQUNGLENBQUMsQ0FBQyxHQUFHLENBQUM7d0JBQ0wsS0FBSyxFQUFFLDRCQUE0Qjt3QkFDbkMsS0FBSyxFQUFFOzRCQUNOLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU07NEJBQzVFLFNBQVMsRUFBRSxZQUFZOzRCQUN2QixTQUFTLEVBQUUsYUFBYTs0QkFDeEIsV0FBVyxFQUFFLGFBQWE7NEJBQzFCLFlBQVksRUFBRSxZQUFZOzRCQUMxQixlQUFlLEVBQUUsYUFBYSxDQUFDLGdCQUFnQixDQUFDO3lCQUNoRDtxQkFDRCxDQUFDO2lCQUNGLENBQUM7Z0JBQ0YsQ0FBQyxDQUFDLEdBQUcsQ0FBQztvQkFDTCxLQUFLLEVBQUUsZ0NBQWdDO29CQUN2QyxLQUFLLEVBQUU7d0JBQ04sR0FBRyxZQUFZLENBQUMsUUFBUSxFQUFFO3dCQUMxQixlQUFlLEVBQUUsYUFBYSxDQUFDLGdCQUFnQixDQUFDO3FCQUNoRDtpQkFDRCxDQUFDO2FBQ0YsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUM3QixLQUFLLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxHQUFHO1NBQ2pDLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtZQUN6QixNQUFNLGFBQWEsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFBQyxPQUFPLFNBQVMsQ0FBQztZQUFDLENBQUM7WUFFekMsTUFBTSxlQUFlLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFakgsTUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3RELE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLGFBQWEsTUFBTSxhQUFhLE1BQU0sT0FBTyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEksTUFBTSxhQUFhLEdBQUcscUJBQXFCLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDL0ksTUFBTSxzQkFBc0IsR0FBRyxHQUFHLFlBQVksR0FBRyxjQUFjLFlBQVksYUFBYSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztZQUU3RyxNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDckcsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsY0FBYyxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVoSSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUM1QyxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN6QyxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsSUFBSSxVQUFVLENBQUMsV0FBVyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDdkUsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDckUsQ0FBQztnQkFDRCxPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEdBQUcsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3BHLENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTztnQkFDTixDQUFDLENBQUMsR0FBRyxDQUFDO29CQUNMLEtBQUssRUFBRSw2QkFBNkI7b0JBQ3BDLEtBQUssRUFBRTt3QkFDTixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFO3dCQUN4QyxlQUFlLEVBQUUsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFDbkY7aUJBQ0QsQ0FBQztnQkFDRixDQUFDLENBQUMsR0FBRyxDQUFDO29CQUNMLEtBQUssRUFBRSw2QkFBNkI7b0JBQ3BDLEtBQUssRUFBRTt3QkFDTixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFO3dCQUN4QyxZQUFZO3dCQUNaLFNBQVMsRUFBRSxzQkFBc0I7d0JBQ2pDLFlBQVksRUFBRSxzQkFBc0I7d0JBQ3BDLFdBQVcsRUFBRSxzQkFBc0I7d0JBQ25DLFNBQVMsRUFBRSxZQUFZO3FCQUN2QjtpQkFDRCxDQUFDO2dCQUNGLENBQUMsQ0FBQyxHQUFHLENBQUM7b0JBQ0wsS0FBSyxFQUFFLDJCQUEyQjtvQkFDbEMsS0FBSyxFQUFFO3dCQUNOLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUU7d0JBQ3RDLFlBQVk7d0JBQ1osTUFBTSxFQUFFLGFBQWE7d0JBQ3JCLFNBQVMsRUFBRSxZQUFZO3dCQUN2QixlQUFlLEVBQUUsYUFBYSxDQUFDLHVCQUF1QixDQUFDO3FCQUN2RDtpQkFDRCxDQUFDO2FBQ0YsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUM3QixLQUFLLEVBQUUsbUJBQW1CO1lBQzFCLEtBQUssRUFBRTtnQkFDTixRQUFRLEVBQUUsVUFBVTtnQkFDcEIsUUFBUSxFQUFFLFNBQVM7Z0JBQ25CLEdBQUcsRUFBRSxLQUFLO2dCQUNWLElBQUksRUFBRSxLQUFLO2dCQUNYLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUTthQUN0QjtTQUNELEVBQUU7WUFDRixJQUFJLENBQUMsY0FBYztZQUNuQixPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1NBQ3ZJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTVCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQztZQUNsRCxPQUFPLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDdEMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUM7WUFDL0IsbUJBQW1CLEVBQUUsS0FBSztZQUMxQixtQkFBbUIsRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUMzQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGVBQWUsQ0FBQztnQkFDdEUsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQUMsQ0FBQztnQkFDbEMsT0FBTyxDQUFDLENBQUM7WUFDVixDQUFDLENBQUM7U0FDRixDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQy9CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQixPQUFPO1lBQ1IsQ0FBQztZQUNELE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBRTFGLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxFQUFFLENBQUMsbURBQW1ELEVBQUUsQ0FBQyxDQUFDO1lBQ3hKLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLFVBQVUsQ0FBQyxHQUFHLElBQUksQ0FBQztZQUNoRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUM7WUFDbEUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsVUFBVSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixJQUFJLENBQUMsQ0FBQyw4QkFBOEI7WUFDckksaUdBQWlHO1FBQ2xHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzlELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDakIsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUN4RixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLG9CQUFvQixDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0RSxDQUFDO0NBK0NELENBQUE7QUF0a0JZLHlCQUF5QjtJQWdDbkMsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGFBQWEsQ0FBQTtHQWpDSCx5QkFBeUIsQ0Fza0JyQyJ9