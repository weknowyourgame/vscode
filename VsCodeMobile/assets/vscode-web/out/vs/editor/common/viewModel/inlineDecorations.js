/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Range } from '../core/range.js';
export var InlineDecorationType;
(function (InlineDecorationType) {
    InlineDecorationType[InlineDecorationType["Regular"] = 0] = "Regular";
    InlineDecorationType[InlineDecorationType["Before"] = 1] = "Before";
    InlineDecorationType[InlineDecorationType["After"] = 2] = "After";
    InlineDecorationType[InlineDecorationType["RegularAffectingLetterSpacing"] = 3] = "RegularAffectingLetterSpacing";
})(InlineDecorationType || (InlineDecorationType = {}));
export class InlineDecoration {
    constructor(range, inlineClassName, type) {
        this.range = range;
        this.inlineClassName = inlineClassName;
        this.type = type;
    }
}
export class SingleLineInlineDecoration {
    constructor(startOffset, endOffset, inlineClassName, inlineClassNameAffectsLetterSpacing) {
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.inlineClassName = inlineClassName;
        this.inlineClassNameAffectsLetterSpacing = inlineClassNameAffectsLetterSpacing;
    }
    toInlineDecoration(lineNumber) {
        return new InlineDecoration(new Range(lineNumber, this.startOffset + 1, lineNumber, this.endOffset + 1), this.inlineClassName, this.inlineClassNameAffectsLetterSpacing ? 3 /* InlineDecorationType.RegularAffectingLetterSpacing */ : 0 /* InlineDecorationType.Regular */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRGVjb3JhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi92aWV3TW9kZWwvaW5saW5lRGVjb3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXpDLE1BQU0sQ0FBTixJQUFrQixvQkFLakI7QUFMRCxXQUFrQixvQkFBb0I7SUFDckMscUVBQVcsQ0FBQTtJQUNYLG1FQUFVLENBQUE7SUFDVixpRUFBUyxDQUFBO0lBQ1QsaUhBQWlDLENBQUE7QUFDbEMsQ0FBQyxFQUxpQixvQkFBb0IsS0FBcEIsb0JBQW9CLFFBS3JDO0FBRUQsTUFBTSxPQUFPLGdCQUFnQjtJQUM1QixZQUNpQixLQUFZLEVBQ1osZUFBdUIsRUFDdkIsSUFBMEI7UUFGMUIsVUFBSyxHQUFMLEtBQUssQ0FBTztRQUNaLG9CQUFlLEdBQWYsZUFBZSxDQUFRO1FBQ3ZCLFNBQUksR0FBSixJQUFJLENBQXNCO0lBQ3ZDLENBQUM7Q0FDTDtBQUVELE1BQU0sT0FBTywwQkFBMEI7SUFDdEMsWUFDaUIsV0FBbUIsRUFDbkIsU0FBaUIsRUFDakIsZUFBdUIsRUFDdkIsbUNBQTRDO1FBSDVDLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQ25CLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFDakIsb0JBQWUsR0FBZixlQUFlLENBQVE7UUFDdkIsd0NBQW1DLEdBQW5DLG1DQUFtQyxDQUFTO0lBRTdELENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxVQUFrQjtRQUNwQyxPQUFPLElBQUksZ0JBQWdCLENBQzFCLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFDM0UsSUFBSSxDQUFDLGVBQWUsRUFDcEIsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLENBQUMsNERBQW9ELENBQUMscUNBQTZCLENBQzVILENBQUM7SUFDSCxDQUFDO0NBQ0QifQ==