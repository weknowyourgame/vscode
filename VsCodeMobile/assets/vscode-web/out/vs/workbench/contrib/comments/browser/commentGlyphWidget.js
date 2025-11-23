/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import { Color } from '../../../../base/common/color.js';
import { OverviewRulerLane } from '../../../../editor/common/model.js';
import { ModelDecorationOptions } from '../../../../editor/common/model/textModel.js';
import { darken, editorBackground, editorForeground, listInactiveSelectionBackground, opaque, registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { CommentThreadState } from '../../../../editor/common/languages.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
export const overviewRulerCommentingRangeForeground = registerColor('editorGutter.commentRangeForeground', { dark: opaque(listInactiveSelectionBackground, editorBackground), light: darken(opaque(listInactiveSelectionBackground, editorBackground), .05), hcDark: Color.white, hcLight: Color.black }, nls.localize('editorGutterCommentRangeForeground', 'Editor gutter decoration color for commenting ranges. This color should be opaque.'));
const overviewRulerCommentForeground = registerColor('editorOverviewRuler.commentForeground', overviewRulerCommentingRangeForeground, nls.localize('editorOverviewRuler.commentForeground', 'Editor overview ruler decoration color for resolved comments. This color should be opaque.'));
const overviewRulerCommentUnresolvedForeground = registerColor('editorOverviewRuler.commentUnresolvedForeground', overviewRulerCommentForeground, nls.localize('editorOverviewRuler.commentUnresolvedForeground', 'Editor overview ruler decoration color for unresolved comments. This color should be opaque.'));
const overviewRulerCommentDraftForeground = registerColor('editorOverviewRuler.commentDraftForeground', overviewRulerCommentUnresolvedForeground, nls.localize('editorOverviewRuler.commentDraftForeground', 'Editor overview ruler decoration color for comment threads with draft comments. This color should be opaque.'));
const editorGutterCommentGlyphForeground = registerColor('editorGutter.commentGlyphForeground', { dark: editorForeground, light: editorForeground, hcDark: Color.black, hcLight: Color.white }, nls.localize('editorGutterCommentGlyphForeground', 'Editor gutter decoration color for commenting glyphs.'));
registerColor('editorGutter.commentUnresolvedGlyphForeground', editorGutterCommentGlyphForeground, nls.localize('editorGutterCommentUnresolvedGlyphForeground', 'Editor gutter decoration color for commenting glyphs for unresolved comment threads.'));
registerColor('editorGutter.commentDraftGlyphForeground', editorGutterCommentGlyphForeground, nls.localize('editorGutterCommentDraftGlyphForeground', 'Editor gutter decoration color for commenting glyphs for comment threads with draft comments.'));
export class CommentGlyphWidget extends Disposable {
    static { this.description = 'comment-glyph-widget'; }
    constructor(editor, lineNumber) {
        super();
        this._threadHasDraft = false;
        this._onDidChangeLineNumber = this._register(new Emitter());
        this.onDidChangeLineNumber = this._onDidChangeLineNumber.event;
        this._commentsOptions = this.createDecorationOptions();
        this._editor = editor;
        this._commentsDecorations = this._editor.createDecorationsCollection();
        this._register(this._commentsDecorations.onDidChange(e => {
            const range = (this._commentsDecorations.length > 0 ? this._commentsDecorations.getRange(0) : null);
            if (range && range.endLineNumber !== this._lineNumber) {
                this._lineNumber = range.endLineNumber;
                this._onDidChangeLineNumber.fire(this._lineNumber);
            }
        }));
        this._register(toDisposable(() => this._commentsDecorations.clear()));
        this.setLineNumber(lineNumber);
    }
    createDecorationOptions() {
        // Priority: draft > unresolved > resolved
        let className;
        if (this._threadHasDraft) {
            className = 'comment-range-glyph comment-thread-draft';
        }
        else {
            const unresolved = this._threadState === CommentThreadState.Unresolved;
            className = `comment-range-glyph comment-thread${unresolved ? '-unresolved' : ''}`;
        }
        const decorationOptions = {
            description: CommentGlyphWidget.description,
            isWholeLine: true,
            overviewRuler: {
                color: themeColorFromId(this._threadHasDraft ? overviewRulerCommentDraftForeground :
                    (this._threadState === CommentThreadState.Unresolved ? overviewRulerCommentUnresolvedForeground : overviewRulerCommentForeground)),
                position: OverviewRulerLane.Center
            },
            collapseOnReplaceEdit: true,
            linesDecorationsClassName: className
        };
        return ModelDecorationOptions.createDynamic(decorationOptions);
    }
    setThreadState(state, hasDraft = false) {
        if (this._threadState !== state || this._threadHasDraft !== hasDraft) {
            this._threadState = state;
            this._threadHasDraft = hasDraft;
            this._commentsOptions = this.createDecorationOptions();
            this._updateDecorations();
        }
    }
    _updateDecorations() {
        const commentsDecorations = [{
                range: {
                    startLineNumber: this._lineNumber, startColumn: 1,
                    endLineNumber: this._lineNumber, endColumn: 1
                },
                options: this._commentsOptions
            }];
        this._commentsDecorations.set(commentsDecorations);
    }
    setLineNumber(lineNumber) {
        this._lineNumber = lineNumber;
        this._updateDecorations();
    }
    getPosition() {
        const range = (this._commentsDecorations.length > 0 ? this._commentsDecorations.getRange(0) : null);
        return {
            position: {
                lineNumber: range ? range.endLineNumber : this._lineNumber,
                column: 1
            },
            preference: [0 /* ContentWidgetPositionPreference.EXACT */]
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudEdseXBoV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NvbW1lbnRzL2Jyb3dzZXIvY29tbWVudEdseXBoV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXpELE9BQU8sRUFBMkIsaUJBQWlCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLCtCQUErQixFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN4SyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUVyRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUUzRCxNQUFNLENBQUMsTUFBTSxzQ0FBc0MsR0FBRyxhQUFhLENBQUMscUNBQXFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLCtCQUErQixFQUFFLGdCQUFnQixDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsK0JBQStCLEVBQUUsZ0JBQWdCLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFB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