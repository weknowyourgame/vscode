/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditorConfiguration } from '../../../browser/config/editorConfiguration.js';
import { EditorFontLigatures, EditorFontVariations } from '../../../common/config/editorOptions.js';
import { FontInfo } from '../../../common/config/fontInfo.js';
import { TestAccessibilityService } from '../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
export class TestConfiguration extends EditorConfiguration {
    constructor(opts) {
        super(false, MenuId.EditorContext, opts, null, new TestAccessibilityService());
    }
    _readEnvConfiguration() {
        const envConfig = this.getRawOptions().envConfig;
        return {
            extraEditorClassName: envConfig?.extraEditorClassName ?? '',
            outerWidth: envConfig?.outerWidth ?? 100,
            outerHeight: envConfig?.outerHeight ?? 100,
            emptySelectionClipboard: envConfig?.emptySelectionClipboard ?? true,
            pixelRatio: envConfig?.pixelRatio ?? 1,
            accessibilitySupport: envConfig?.accessibilitySupport ?? 0 /* AccessibilitySupport.Unknown */,
            editContextSupported: true
        };
    }
    _readFontInfo(styling) {
        return new FontInfo({
            pixelRatio: 1,
            fontFamily: 'mockFont',
            fontWeight: 'normal',
            fontSize: 14,
            fontFeatureSettings: EditorFontLigatures.OFF,
            fontVariationSettings: EditorFontVariations.OFF,
            lineHeight: 19,
            letterSpacing: 1.5,
            isMonospace: true,
            typicalHalfwidthCharacterWidth: 10,
            typicalFullwidthCharacterWidth: 20,
            canUseHalfwidthRightwardsArrow: true,
            spaceWidth: 10,
            middotWidth: 10,
            wsmiddotWidth: 10,
            maxDigitWidth: 10,
        }, true);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdENvbmZpZ3VyYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9jb25maWcvdGVzdENvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFxQixNQUFNLGdEQUFnRCxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BHLE9BQU8sRUFBZ0IsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHNUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDdEgsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRXhFLE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxtQkFBbUI7SUFFekQsWUFBWSxJQUE2QztRQUN4RCxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLHdCQUF3QixFQUFFLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRWtCLHFCQUFxQjtRQUN2QyxNQUFNLFNBQVMsR0FBSSxJQUFJLENBQUMsYUFBYSxFQUFvQyxDQUFDLFNBQVMsQ0FBQztRQUNwRixPQUFPO1lBQ04sb0JBQW9CLEVBQUUsU0FBUyxFQUFFLG9CQUFvQixJQUFJLEVBQUU7WUFDM0QsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLElBQUksR0FBRztZQUN4QyxXQUFXLEVBQUUsU0FBUyxFQUFFLFdBQVcsSUFBSSxHQUFHO1lBQzFDLHVCQUF1QixFQUFFLFNBQVMsRUFBRSx1QkFBdUIsSUFBSSxJQUFJO1lBQ25FLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxJQUFJLENBQUM7WUFDdEMsb0JBQW9CLEVBQUUsU0FBUyxFQUFFLG9CQUFvQix3Q0FBZ0M7WUFDckYsb0JBQW9CLEVBQUUsSUFBSTtTQUMxQixDQUFDO0lBQ0gsQ0FBQztJQUVrQixhQUFhLENBQUMsT0FBcUI7UUFDckQsT0FBTyxJQUFJLFFBQVEsQ0FBQztZQUNuQixVQUFVLEVBQUUsQ0FBQztZQUNiLFVBQVUsRUFBRSxVQUFVO1lBQ3RCLFVBQVUsRUFBRSxRQUFRO1lBQ3BCLFFBQVEsRUFBRSxFQUFFO1lBQ1osbUJBQW1CLEVBQUUsbUJBQW1CLENBQUMsR0FBRztZQUM1QyxxQkFBcUIsRUFBRSxvQkFBb0IsQ0FBQyxHQUFHO1lBQy9DLFVBQVUsRUFBRSxFQUFFO1lBQ2QsYUFBYSxFQUFFLEdBQUc7WUFDbEIsV0FBVyxFQUFFLElBQUk7WUFDakIsOEJBQThCLEVBQUUsRUFBRTtZQUNsQyw4QkFBOEIsRUFBRSxFQUFFO1lBQ2xDLDhCQUE4QixFQUFFLElBQUk7WUFDcEMsVUFBVSxFQUFFLEVBQUU7WUFDZCxXQUFXLEVBQUUsRUFBRTtZQUNmLGFBQWEsRUFBRSxFQUFFO1lBQ2pCLGFBQWEsRUFBRSxFQUFFO1NBQ2pCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDVixDQUFDO0NBQ0QifQ==