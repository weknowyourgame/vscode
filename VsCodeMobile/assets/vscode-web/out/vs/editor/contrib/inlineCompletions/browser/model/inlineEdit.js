/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class InlineEdit {
    constructor(edit, commands, inlineSuggestion) {
        this.edit = edit;
        this.commands = commands;
        this.inlineSuggestion = inlineSuggestion;
    }
    get range() {
        return this.edit.range;
    }
    get text() {
        return this.edit.text;
    }
    equals(other) {
        return this.edit.equals(other.edit)
            && this.inlineSuggestion === other.inlineSuggestion;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2lubGluZUVkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFNaEcsTUFBTSxPQUFPLFVBQVU7SUFDdEIsWUFDaUIsSUFBcUIsRUFDckIsUUFBNEMsRUFDNUMsZ0JBQXNDO1FBRnRDLFNBQUksR0FBSixJQUFJLENBQWlCO1FBQ3JCLGFBQVEsR0FBUixRQUFRLENBQW9DO1FBQzVDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBc0I7SUFDbkQsQ0FBQztJQUVMLElBQVcsS0FBSztRQUNmLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDeEIsQ0FBQztJQUVELElBQVcsSUFBSTtRQUNkLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFpQjtRQUM5QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7ZUFDL0IsSUFBSSxDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztJQUN0RCxDQUFDO0NBQ0QifQ==