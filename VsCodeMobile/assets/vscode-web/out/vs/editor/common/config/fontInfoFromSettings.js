/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditorOptions } from './editorOptions.js';
import { BareFontInfo } from './fontInfo.js';
export function createBareFontInfoFromValidatedSettings(options, pixelRatio, ignoreEditorZoom) {
    const fontFamily = options.get(58 /* EditorOption.fontFamily */);
    const fontWeight = options.get(62 /* EditorOption.fontWeight */);
    const fontSize = options.get(61 /* EditorOption.fontSize */);
    const fontFeatureSettings = options.get(60 /* EditorOption.fontLigatures */);
    const fontVariationSettings = options.get(63 /* EditorOption.fontVariations */);
    const lineHeight = options.get(75 /* EditorOption.lineHeight */);
    const letterSpacing = options.get(72 /* EditorOption.letterSpacing */);
    return BareFontInfo._create(fontFamily, fontWeight, fontSize, fontFeatureSettings, fontVariationSettings, lineHeight, letterSpacing, pixelRatio, ignoreEditorZoom);
}
export function createBareFontInfoFromRawSettings(opts, pixelRatio, ignoreEditorZoom = false) {
    const fontFamily = EditorOptions.fontFamily.validate(opts.fontFamily);
    const fontWeight = EditorOptions.fontWeight.validate(opts.fontWeight);
    const fontSize = EditorOptions.fontSize.validate(opts.fontSize);
    const fontFeatureSettings = EditorOptions.fontLigatures2.validate(opts.fontLigatures);
    const fontVariationSettings = EditorOptions.fontVariations.validate(opts.fontVariations);
    const lineHeight = EditorOptions.lineHeight.validate(opts.lineHeight);
    const letterSpacing = EditorOptions.letterSpacing.validate(opts.letterSpacing);
    return BareFontInfo._create(fontFamily, fontWeight, fontSize, fontFeatureSettings, fontVariationSettings, lineHeight, letterSpacing, pixelRatio, ignoreEditorZoom);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9udEluZm9Gcm9tU2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm9Gcm9tU2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFnQixhQUFhLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNqRSxPQUFPLEVBQTJCLFlBQVksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUV0RSxNQUFNLFVBQVUsdUNBQXVDLENBQUMsT0FBZ0MsRUFBRSxVQUFrQixFQUFFLGdCQUF5QjtJQUN0SSxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxrQ0FBeUIsQ0FBQztJQUN4RCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxrQ0FBeUIsQ0FBQztJQUN4RCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxnQ0FBdUIsQ0FBQztJQUNwRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLHFDQUE0QixDQUFDO0lBQ3BFLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsc0NBQTZCLENBQUM7SUFDdkUsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsa0NBQXlCLENBQUM7SUFDeEQsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLEdBQUcscUNBQTRCLENBQUM7SUFDOUQsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixDQUFDLENBQUM7QUFDcEssQ0FBQztBQUVELE1BQU0sVUFBVSxpQ0FBaUMsQ0FBQyxJQVFqRCxFQUFFLFVBQWtCLEVBQUUsbUJBQTRCLEtBQUs7SUFDdkQsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN0RSxNQUFNLFFBQVEsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEUsTUFBTSxtQkFBbUIsR0FBRyxhQUFhLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDdEYsTUFBTSxxQkFBcUIsR0FBRyxhQUFhLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDekYsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMvRSxPQUFPLFlBQVksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztBQUNwSyxDQUFDIn0=