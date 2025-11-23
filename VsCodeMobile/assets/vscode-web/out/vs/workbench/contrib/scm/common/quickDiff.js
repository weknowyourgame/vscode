/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Color } from '../../../../base/common/color.js';
import { darken, editorBackground, editorForeground, listInactiveSelectionBackground, opaque, editorErrorForeground, registerColor, transparent, lighten } from '../../../../platform/theme/common/colorRegistry.js';
export const IQuickDiffService = createDecorator('quickDiff');
const editorGutterModifiedBackground = registerColor('editorGutter.modifiedBackground', {
    dark: '#1B81A8', light: '#2090D3', hcDark: '#1B81A8', hcLight: '#2090D3'
}, nls.localize('editorGutterModifiedBackground', "Editor gutter background color for lines that are modified."));
registerColor('editorGutter.modifiedSecondaryBackground', { dark: darken(editorGutterModifiedBackground, 0.5), light: lighten(editorGutterModifiedBackground, 0.7), hcDark: '#1B81A8', hcLight: '#2090D3' }, nls.localize('editorGutterModifiedSecondaryBackground', "Editor gutter secondary background color for lines that are modified."));
const editorGutterAddedBackground = registerColor('editorGutter.addedBackground', {
    dark: '#487E02', light: '#48985D', hcDark: '#487E02', hcLight: '#48985D'
}, nls.localize('editorGutterAddedBackground', "Editor gutter background color for lines that are added."));
registerColor('editorGutter.addedSecondaryBackground', { dark: darken(editorGutterAddedBackground, 0.5), light: lighten(editorGutterAddedBackground, 0.7), hcDark: '#487E02', hcLight: '#48985D' }, nls.localize('editorGutterAddedSecondaryBackground', "Editor gutter secondary background color for lines that are added."));
const editorGutterDeletedBackground = registerColor('editorGutter.deletedBackground', editorErrorForeground, nls.localize('editorGutterDeletedBackground', "Editor gutter background color for lines that are deleted."));
registerColor('editorGutter.deletedSecondaryBackground', { dark: darken(editorGutterDeletedBackground, 0.4), light: lighten(editorGutterDeletedBackground, 0.3), hcDark: '#F48771', hcLight: '#B5200D' }, nls.localize('editorGutterDeletedSecondaryBackground', "Editor gutter secondary background color for lines that are deleted."));
export const minimapGutterModifiedBackground = registerColor('minimapGutter.modifiedBackground', editorGutterModifiedBackground, nls.localize('minimapGutterModifiedBackground', "Minimap gutter background color for lines that are modified."));
export const minimapGutterAddedBackground = registerColor('minimapGutter.addedBackground', editorGutterAddedBackground, nls.localize('minimapGutterAddedBackground', "Minimap gutter background color for lines that are added."));
export const minimapGutterDeletedBackground = registerColor('minimapGutter.deletedBackground', editorGutterDeletedBackground, nls.localize('minimapGutterDeletedBackground', "Minimap gutter background color for lines that are deleted."));
export const overviewRulerModifiedForeground = registerColor('editorOverviewRuler.modifiedForeground', transparent(editorGutterModifiedBackground, 0.6), nls.localize('overviewRulerModifiedForeground', 'Overview ruler marker color for modified content.'));
export const overviewRulerAddedForeground = registerColor('editorOverviewRuler.addedForeground', transparent(editorGutterAddedBackground, 0.6), nls.localize('overviewRulerAddedForeground', 'Overview ruler marker color for added content.'));
export const overviewRulerDeletedForeground = registerColor('editorOverviewRuler.deletedForeground', transparent(editorGutterDeletedBackground, 0.6), nls.localize('overviewRulerDeletedForeground', 'Overview ruler marker color for deleted content.'));
export const editorGutterItemGlyphForeground = registerColor('editorGutter.itemGlyphForeground', { dark: editorForeground, light: editorForeground, hcDark: Color.black, hcLight: Color.white }, nls.localize('editorGutterItemGlyphForeground', 'Editor gutter decoration color for gutter item glyphs.'));
export const editorGutterItemBackground = registerColor('editorGutter.itemBackground', { dark: opaque(listInactiveSelectionBackground, editorBackground), light: darken(opaque(listInactiveSelectionBackground, editorBackground), .05), hcDark: Color.white, hcLight: Color.black }, nls.localize('editorGutterItemBackground', 'Editor gutter decoration color for gutter item background. This color should be opaque.'));
export var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["Modify"] = 0] = "Modify";
    ChangeType[ChangeType["Add"] = 1] = "Add";
    ChangeType[ChangeType["Delete"] = 2] = "Delete";
})(ChangeType || (ChangeType = {}));
export function getChangeType(change) {
    if (change.originalEndLineNumber === 0) {
        return ChangeType.Add;
    }
    else if (change.modifiedEndLineNumber === 0) {
        return ChangeType.Delete;
    }
    else {
        return ChangeType.Modify;
    }
}
export function getChangeTypeColor(theme, changeType) {
    switch (changeType) {
        case ChangeType.Modify: return theme.getColor(editorGutterModifiedBackground);
        case ChangeType.Add: return theme.getColor(editorGutterAddedBackground);
        case ChangeType.Delete: return theme.getColor(editorGutterDeletedBackground);
    }
}
export function compareChanges(a, b) {
    let result = a.modifiedStartLineNumber - b.modifiedStartLineNumber;
    if (result !== 0) {
        return result;
    }
    result = a.modifiedEndLineNumber - b.modifiedEndLineNumber;
    if (result !== 0) {
        return result;
    }
    result = a.originalStartLineNumber - b.originalStartLineNumber;
    if (result !== 0) {
        return result;
    }
    return a.originalEndLineNumber - b.originalEndLineNumber;
}
export function getChangeHeight(change) {
    const modified = change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
    const original = change.originalEndLineNumber - change.originalStartLineNumber + 1;
    if (change.originalEndLineNumber === 0) {
        return modified;
    }
    else if (change.modifiedEndLineNumber === 0) {
        return original;
    }
    else {
        return modified + original;
    }
}
export function getModifiedEndLineNumber(change) {
    if (change.modifiedEndLineNumber === 0) {
        return change.modifiedStartLineNumber === 0 ? 1 : change.modifiedStartLineNumber;
    }
    else {
        return change.modifiedEndLineNumber;
    }
}
export function lineIntersectsChange(lineNumber, change) {
    // deletion at the beginning of the file
    if (lineNumber === 1 && change.modifiedStartLineNumber === 0 && change.modifiedEndLineNumber === 0) {
        return true;
    }
    return lineNumber >= change.modifiedStartLineNumber && lineNumber <= (change.modifiedEndLineNumber || change.modifiedStartLineNumber);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tEaWZmLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9jb21tb24vcXVpY2tEaWZmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFHMUMsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBTzdGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQ04sTUFBTSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLCtCQUErQixFQUFFLE1BQU0sRUFDbkYscUJBQXFCLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFDakQsT0FBTyxFQUNQLE1BQU0sb0RBQW9ELENBQUM7QUFFNUQsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFvQixXQUFXLENBQUMsQ0FBQztBQUVqRixNQUFNLDhCQUE4QixHQUFHLGFBQWEsQ0FBQyxpQ0FBaUMsRUFBRTtJQUN2RixJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUztDQUN4RSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsNkRBQTZELENBQUMsQ0FBQyxDQUFDO0FBRWxILGFBQWEsQ0FBQywwQ0FBMEMsRUFDdkQsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsOEJBQThCLEVBQUUsR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQ2pKLEdBQUcsQ0FBQyxRQUFRLENBQUMseUNBQXlDLEVBQUUsdUVBQXVFLENB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