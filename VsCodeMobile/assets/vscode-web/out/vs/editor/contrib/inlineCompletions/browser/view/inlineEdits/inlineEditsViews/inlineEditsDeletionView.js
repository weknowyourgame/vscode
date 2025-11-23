/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { n } from '../../../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { constObservable, derived, derivedObservableWithCache } from '../../../../../../../base/common/observable.js';
import { editorBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../../../common/core/position.js';
import { getOriginalBorderColor, originalBackgroundColor } from '../theme.js';
import { getPrefixTrim, mapOutFalsy, maxContentWidthInRange } from '../utils/utils.js';
const HORIZONTAL_PADDING = 0;
const VERTICAL_PADDING = 0;
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH = 3;
const BORDER_RADIUS = 4;
export class InlineEditsDeletionView extends Disposable {
    constructor(_editor, _edit, _uiState, _tabAction) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._uiState = _uiState;
        this._tabAction = _tabAction;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._display = derived(this, reader => !!this._uiState.read(reader) ? 'block' : 'none');
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
        this._maxPrefixTrim = derived(this, reader => {
            const state = this._uiState.read(reader);
            if (!state) {
                return { prefixTrim: 0, prefixLeftOffset: 0 };
            }
            return getPrefixTrim(state.deletions, state.originalRange, [], this._editor);
        });
        this._editorLayoutInfo = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return null;
            }
            const state = this._uiState.read(reader);
            if (!state) {
                return null;
            }
            const editorLayout = this._editorObs.layoutInfo.read(reader);
            const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
            const w = this._editorObs.getOption(59 /* EditorOption.fontInfo */).map(f => f.typicalHalfwidthCharacterWidth).read(reader);
            const right = editorLayout.contentLeft + Math.max(this._editorMaxContentWidthInRange.read(reader), w) - horizontalScrollOffset;
            const range = inlineEdit.originalLineRange;
            const selectionTop = this._originalVerticalStartPosition.read(reader) ?? this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            const selectionBottom = this._originalVerticalEndPosition.read(reader) ?? this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
            const left = editorLayout.contentLeft + this._maxPrefixTrim.read(reader).prefixLeftOffset - horizontalScrollOffset;
            if (right <= left) {
                return null;
            }
            const codeRect = Rect.fromLeftTopRightBottom(left, selectionTop, right, selectionBottom).withMargin(VERTICAL_PADDING, HORIZONTAL_PADDING);
            return {
                codeRect,
                contentLeft: editorLayout.contentLeft,
            };
        }).recomputeInitiallyAndOnChange(this._store);
        this._originalOverlay = n.div({
            style: { pointerEvents: 'none', }
        }, derived(this, reader => {
            const layoutInfoObs = mapOutFalsy(this._editorLayoutInfo).read(reader);
            if (!layoutInfoObs) {
                return undefined;
            }
            // Create an overlay which hides the left hand side of the original overlay when it overflows to the left
            // such that there is a smooth transition at the edge of content left
            const overlayhider = layoutInfoObs.map(layoutInfo => Rect.fromLeftTopRightBottom(layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH, layoutInfo.codeRect.top, layoutInfo.contentLeft, layoutInfo.codeRect.bottom));
            const overlayRect = derived(this, reader => {
                const rect = layoutInfoObs.read(reader).codeRect;
                const overlayHider = overlayhider.read(reader);
                return rect.intersectHorizontal(new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER));
            });
            const separatorWidth = this._uiState.map(s => s?.inDiffEditor ? WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH : WIDGET_SEPARATOR_WIDTH).read(reader);
            const separatorRect = overlayRect.map(rect => rect.withMargin(separatorWidth, separatorWidth));
            return [
                n.div({
                    class: 'originalSeparatorDeletion',
                    style: {
                        ...separatorRect.read(reader).toStyles(),
                        borderRadius: `${BORDER_RADIUS}px`,
                        border: `${BORDER_WIDTH + separatorWidth}px solid ${asCssVariable(editorBackground)}`,
                        boxSizing: 'border-box',
                    }
                }),
                n.div({
                    class: 'originalOverlayDeletion',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        borderRadius: `${BORDER_RADIUS}px`,
                        border: getOriginalBorderColor(this._tabAction).map(bc => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`),
                        boxSizing: 'border-box',
                        backgroundColor: asCssVariable(originalBackgroundColor),
                    }
                }),
                n.div({
                    class: 'originalOverlayHiderDeletion',
                    style: {
                        ...overlayhider.read(reader).toStyles(),
                        backgroundColor: asCssVariable(editorBackground),
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
            [this._originalOverlay],
        ]).keepUpdated(this._store);
        this.isHovered = constObservable(false);
        this._editorObs = observableCodeEditor(this._editor);
        const originalStartPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.startLineNumber, 1) : null;
        });
        const originalEndPosition = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            return inlineEdit ? new Position(inlineEdit.originalLineRange.endLineNumberExclusive, 1) : null;
        });
        this._originalDisplayRange = this._uiState.map(s => s?.originalRange);
        this._originalVerticalStartPosition = this._editorObs.observePosition(originalStartPosition, this._store).map(p => p?.y);
        this._originalVerticalEndPosition = this._editorObs.observePosition(originalEndPosition, this._store).map(p => p?.y);
        this._register(this._editorObs.createOverlayWidget({
            domNode: this._nonOverflowView.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: derived(this, reader => {
                const info = this._editorLayoutInfo.read(reader);
                if (info === null) {
                    return 0;
                }
                return info.codeRect.width;
            }),
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNEZWxldGlvblZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL2lubGluZUVkaXRzVmlld3MvaW5saW5lRWRpdHNEZWxldGlvblZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQWUsTUFBTSxnREFBZ0QsQ0FBQztBQUNuSSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUMvRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFFekYsT0FBTyxFQUF3QixvQkFBb0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUdoRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBSXJFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUM5RSxPQUFPLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRXZGLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0FBQzNC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