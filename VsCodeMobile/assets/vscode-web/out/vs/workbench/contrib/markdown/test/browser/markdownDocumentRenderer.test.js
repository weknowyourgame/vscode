/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { createCodeEditorServices } from '../../../../../editor/test/browser/testCodeEditor.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { renderMarkdownDocument } from '../../browser/markdownDocumentRenderer.js';
suite('Markdown Document Renderer Test', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let extensionService;
    let languageService;
    setup(() => {
        instantiationService = createCodeEditorServices(store);
        extensionService = instantiationService.get(IExtensionService);
        languageService = instantiationService.get(ILanguageService);
    });
    test('Should remove images with relative paths by default', async () => {
        const result = await renderMarkdownDocument('![alt](src/img.png)', extensionService, languageService, {});
        assert.strictEqual(result.toString(), `<p><img alt="alt"></p>\n`);
    });
    test('Can enable images with relative paths using setting', async () => {
        const result = await renderMarkdownDocument('![alt](src/img.png)', extensionService, languageService, {
            sanitizerConfig: {
                allowRelativeMediaPaths: true,
            }
        });
        assert.strictEqual(result.toString(), `<p><img src="src/img.png" alt="alt"></p>\n`);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd25Eb2N1bWVudFJlbmRlcmVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWFya2Rvd24vdGVzdC9icm93c2VyL21hcmtkb3duRG9jdW1lbnRSZW5kZXJlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUduRixLQUFLLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFO0lBQzdDLE1BQU0sS0FBSyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7SUFFeEQsSUFBSSxvQkFBOEMsQ0FBQztJQUNuRCxJQUFJLGdCQUFtQyxDQUFDO0lBQ3hDLElBQUksZUFBaUMsQ0FBQztJQUV0QyxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysb0JBQW9CLEdBQUcsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkQsZ0JBQWdCLEdBQUcsb0JBQW9CLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDL0QsZUFBZSxHQUFHLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzlELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3RFLE1BQU0sTUFBTSxHQUFHLE1BQU0sc0JBQXNCLENBQUMscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLDBCQUEwQixDQUFDLENBQUM7SUFDbkUsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscURBQXFELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDdEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUU7WUFDckcsZUFBZSxFQUFFO2dCQUNoQix1QkFBdUIsRUFBRSxJQUFJO2FBQzdCO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsNENBQTRDLENBQUMsQ0FBQztJQUNyRixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=