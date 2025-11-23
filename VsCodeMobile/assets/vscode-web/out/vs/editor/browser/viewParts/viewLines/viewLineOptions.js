/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class ViewLineOptions {
    constructor(config, themeType) {
        this.themeType = themeType;
        const options = config.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        this.renderWhitespace = options.get(113 /* EditorOption.renderWhitespace */);
        this.experimentalWhitespaceRendering = options.get(47 /* EditorOption.experimentalWhitespaceRendering */);
        this.renderControlCharacters = options.get(108 /* EditorOption.renderControlCharacters */);
        this.spaceWidth = fontInfo.spaceWidth;
        this.middotWidth = fontInfo.middotWidth;
        this.wsmiddotWidth = fontInfo.wsmiddotWidth;
        this.useMonospaceOptimizations = (fontInfo.isMonospace
            && !options.get(40 /* EditorOption.disableMonospaceOptimizations */));
        this.canUseHalfwidthRightwardsArrow = fontInfo.canUseHalfwidthRightwardsArrow;
        this.lineHeight = options.get(75 /* EditorOption.lineHeight */);
        this.stopRenderingLineAfter = options.get(133 /* EditorOption.stopRenderingLineAfter */);
        this.fontLigatures = options.get(60 /* EditorOption.fontLigatures */);
        this.verticalScrollbarSize = options.get(117 /* EditorOption.scrollbar */).verticalScrollbarSize;
        this.useGpu = options.get(46 /* EditorOption.experimentalGpuAcceleration */) === 'on';
    }
    equals(other) {
        return (this.themeType === other.themeType
            && this.renderWhitespace === other.renderWhitespace
            && this.experimentalWhitespaceRendering === other.experimentalWhitespaceRendering
            && this.renderControlCharacters === other.renderControlCharacters
            && this.spaceWidth === other.spaceWidth
            && this.middotWidth === other.middotWidth
            && this.wsmiddotWidth === other.wsmiddotWidth
            && this.useMonospaceOptimizations === other.useMonospaceOptimizations
            && this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
            && this.lineHeight === other.lineHeight
            && this.stopRenderingLineAfter === other.stopRenderingLineAfter
            && this.fontLigatures === other.fontLigatures
            && this.verticalScrollbarSize === other.verticalScrollbarSize
            && this.useGpu === other.useGpu);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVPcHRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmVPcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLE1BQU0sT0FBTyxlQUFlO0lBZ0IzQixZQUFZLE1BQTRCLEVBQUUsU0FBc0I7UUFDL0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUMvQixNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxnQ0FBdUIsQ0FBQztRQUNwRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLEdBQUcseUNBQStCLENBQUM7UUFDbkUsSUFBSSxDQUFDLCtCQUErQixHQUFHLE9BQU8sQ0FBQyxHQUFHLHVEQUE4QyxDQUFDO1FBQ2pHLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxPQUFPLENBQUMsR0FBRyxnREFBc0MsQ0FBQztRQUNqRixJQUFJLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDdEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQztRQUM1QyxJQUFJLENBQUMseUJBQXlCLEdBQUcsQ0FDaEMsUUFBUSxDQUFDLFdBQVc7ZUFDakIsQ0FBQyxPQUFPLENBQUMsR0FBRyxxREFBNEMsQ0FDM0QsQ0FBQztRQUNGLElBQUksQ0FBQyw4QkFBOEIsR0FBRyxRQUFRLENBQUMsOEJBQThCLENBQUM7UUFDOUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxrQ0FBeUIsQ0FBQztRQUN2RCxJQUFJLENBQUMsc0JBQXNCLEdBQUcsT0FBTyxDQUFDLEdBQUcsK0NBQXFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxxQ0FBNEIsQ0FBQztRQUM3RCxJQUFJLENBQUMscUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsa0NBQXdCLENBQUMscUJBQXFCLENBQUM7UUFDdkYsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxtREFBMEMsS0FBSyxJQUFJLENBQUM7SUFDOUUsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFzQjtRQUNuQyxPQUFPLENBQ04sSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsU0FBUztlQUMvQixJQUFJLENBQUMsZ0JBQWdCLEtBQUssS0FBSyxDQUFDLGdCQUFnQjtlQUNoRCxJQUFJLENBQUMsK0JBQStCLEtBQUssS0FBSyxDQUFDLCtCQUErQjtlQUM5RSxJQUFJLENBQUMsdUJBQXVCLEtBQUssS0FBSyxDQUFDLHVCQUF1QjtlQUM5RCxJQUFJLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxVQUFVO2VBQ3BDLElBQUksQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDLFdBQVc7ZUFDdEMsSUFBSSxDQUFDLGFBQWEsS0FBSyxLQUFLLENBQUMsYUFBYTtlQUMxQyxJQUFJLENBQUMseUJBQXlCLEtBQUssS0FBSyxDQUFDLHlCQUF5QjtlQUNsRSxJQUFJLENBQUMsOEJBQThCLEtBQUssS0FBSyxDQUFDLDhCQUE4QjtlQUM1RSxJQUFJLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxVQUFVO2VBQ3BDLElBQUksQ0FBQyxzQkFBc0IsS0FBSyxLQUFLLENBQUMsc0JBQXNCO2VBQzVELElBQUksQ0FBQyxhQUFhLEtBQUssS0FBSyxDQUFDLGFBQWE7ZUFDMUMsSUFBSSxDQUFDLHFCQUFxQixLQUFLLEtBQUssQ0FBQyxxQkFBcUI7ZUFDMUQsSUFBSSxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsTUFBTSxDQUMvQixDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=