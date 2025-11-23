/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatSessionsService } from '../../browser/chatSessions.contribution.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
suite('ChatSessionsService', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let chatSessionsService;
    setup(() => {
        const instantiationService = store.add(workbenchInstantiationService(undefined, store));
        chatSessionsService = store.add(instantiationService.createInstance(ChatSessionsService));
    });
    suite('extractFileNameFromLink', () => {
        function callExtractFileNameFromLink(filePath) {
            return chatSessionsService['extractFileNameFromLink'](filePath);
        }
        test('should extract filename from markdown link with link text', () => {
            const input = 'Read [README](file:///path/to/README.md) for more info';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Read README for more info');
        });
        test('should extract filename from markdown link without link text', () => {
            const input = 'Read [](file:///index.js) for instructions';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Read index.js for instructions');
        });
        test('should extract filename from markdown link with empty link text', () => {
            const input = 'Check [  ](file:///config.json) settings';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Check config.json settings');
        });
        test('should handle multiple file links in same string', () => {
            const input = 'See [main](file:///main.js) and [utils](file:///utils/helper.ts)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'See main and utils');
        });
        test('should handle file path without extension', () => {
            const input = 'Open [](file:///src/components/Button)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Open Button');
        });
        test('should handle deep file paths', () => {
            const input = 'Edit [](file:///very/deep/nested/path/to/file.tsx)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Edit file.tsx');
        });
        test('should handle file path that is just a filename', () => {
            const input = 'View [script](file:///script.py)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'View script');
        });
        test('should handle link text with special characters', () => {
            const input = 'See [App.js (main)](file:///App.js)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'See App.js (main)');
        });
        test('should return original string if no file links present', () => {
            const input = 'This is just regular text with no links';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'This is just regular text with no links');
        });
        test('should handle mixed content with file links and regular text', () => {
            const input = 'Check [config](file:///config.yml) and visit https://example.com';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Check config and visit https://example.com');
        });
        test('should handle file path with query parameters or fragments', () => {
            const input = 'Open [](file:///index.html?param=value#section)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Open index.html?param=value#section');
        });
        test('should handle Windows-style paths', () => {
            const input = 'Edit [](file:///C:/Users/user/Documents/file.txt)';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, 'Edit file.txt');
        });
        test('should preserve whitespace around replacements', () => {
            const input = '   Check [](file:///test.js)   ';
            const result = callExtractFileNameFromLink(input);
            assert.strictEqual(result, '   Check test.js   ');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlc3Npb25zU2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9icm93c2VyL2NoYXRTZXNzaW9uc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDakYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFbEcsS0FBSyxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtJQUNqQyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksbUJBQXdDLENBQUM7SUFFN0MsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNWLE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RixtQkFBbUIsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDM0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO1FBRXJDLFNBQVMsMkJBQTJCLENBQUMsUUFBZ0I7WUFHcEQsT0FBUSxtQkFBMkQsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFHLENBQUM7UUFFRCxJQUFJLENBQUMsMkRBQTJELEVBQUUsR0FBRyxFQUFFO1lBQ3RFLE1BQU0sS0FBSyxHQUFHLHdEQUF3RCxDQUFDO1lBQ3ZF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