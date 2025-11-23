/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var ScrollType;
(function (ScrollType) {
    ScrollType[ScrollType["Smooth"] = 0] = "Smooth";
    ScrollType[ScrollType["Immediate"] = 1] = "Immediate";
})(ScrollType || (ScrollType = {}));
/**
 * @internal
 */
export function isThemeColor(o) {
    return !!o && typeof o.id === 'string';
}
/**
 * The type of the `IEditor`.
 */
export const EditorType = {
    ICodeEditor: 'vs.editor.ICodeEditor',
    IDiffEditor: 'vs.editor.IDiffEditor'
};
/**
 * Built-in commands.
 * @internal
 */
export var Handler;
(function (Handler) {
    Handler["CompositionStart"] = "compositionStart";
    Handler["CompositionEnd"] = "compositionEnd";
    Handler["Type"] = "type";
    Handler["ReplacePreviousChar"] = "replacePreviousChar";
    Handler["CompositionType"] = "compositionType";
    Handler["Paste"] = "paste";
    Handler["Cut"] = "cut";
})(Handler || (Handler = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yQ29tbW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBb05oRyxNQUFNLENBQU4sSUFBa0IsVUFHakI7QUFIRCxXQUFrQixVQUFVO0lBQzNCLCtDQUFVLENBQUE7SUFDVixxREFBYSxDQUFBO0FBQ2QsQ0FBQyxFQUhpQixVQUFVLEtBQVYsVUFBVSxRQUczQjtBQXNZRDs7R0FFRztBQUNILE1BQU0sVUFBVSxZQUFZLENBQUMsQ0FBVTtJQUN0QyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBUSxDQUFnQixDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDeEQsQ0FBQztBQTRIRDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRztJQUN6QixXQUFXLEVBQUUsdUJBQXVCO0lBQ3BDLFdBQVcsRUFBRSx1QkFBdUI7Q0FDcEMsQ0FBQztBQUVGOzs7R0FHRztBQUNILE1BQU0sQ0FBTixJQUFrQixPQVFqQjtBQVJELFdBQWtCLE9BQU87SUFDeEIsZ0RBQXFDLENBQUE7SUFDckMsNENBQWlDLENBQUE7SUFDakMsd0JBQWEsQ0FBQTtJQUNiLHNEQUEyQyxDQUFBO0lBQzNDLDhDQUFtQyxDQUFBO0lBQ25DLDBCQUFlLENBQUE7SUFDZixzQkFBVyxDQUFBO0FBQ1osQ0FBQyxFQVJpQixPQUFPLEtBQVAsT0FBTyxRQVF4QiJ9