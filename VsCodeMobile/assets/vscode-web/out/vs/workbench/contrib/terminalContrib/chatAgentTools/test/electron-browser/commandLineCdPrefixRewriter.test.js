/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { isWindows } from '../../../../../../base/common/platform.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { CommandLineCdPrefixRewriter } from '../../browser/tools/commandLineRewriter/commandLineCdPrefixRewriter.js';
suite('CommandLineCdPrefixRewriter', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let rewriter;
    function createRewriteOptions(command, cwd, shell, os) {
        return {
            commandLine: command,
            cwd,
            shell,
            os
        };
    }
    setup(() => {
        instantiationService = workbenchInstantiationService({}, store);
        rewriter = store.add(instantiationService.createInstance(CommandLineCdPrefixRewriter));
    });
    suite('cd <cwd> && <suffix> -> <suffix>', () => {
        (!isWindows ? suite : suite.skip)('Posix', () => {
            const cwd = URI.file('/test/workspace');
            function t(commandLine, shell, expectedResult) {
                const options = createRewriteOptions(commandLine, cwd, shell, 3 /* OperatingSystem.Linux */);
                const result = rewriter.rewrite(options);
                strictEqual(result?.rewritten, expectedResult);
                if (expectedResult !== undefined) {
                    strictEqual(result?.reasoning, 'Removed redundant cd command');
                }
            }
            test('should return undefined when no cd prefix pattern matches', () => t('echo hello world', 'bash', undefined));
            test('should return undefined when cd pattern does not have suffix', () => t('cd /some/path', 'bash', undefined));
            test('should rewrite command with ; separator when directory matches cwd', () => t('cd /test/workspace; npm test', 'pwsh', 'npm test'));
            test('should rewrite command with && separator when directory matches cwd', () => t('cd /test/workspace && npm install', 'bash', 'npm install'));
            test('should rewrite command when the path is wrapped in double quotes', () => t('cd "/test/workspace" && npm install', 'bash', 'npm install'));
            test('should not rewrite command when directory does not match cwd', () => t('cd /different/path && npm install', 'bash', undefined));
            test('should handle commands with complex suffixes', () => t('cd /test/workspace && npm install && npm test && echo "done"', 'bash', 'npm install && npm test && echo "done"'));
            test('should ignore any trailing forward slash', () => t('cd /test/workspace/ && npm install', 'bash', 'npm install'));
        });
        (isWindows ? suite : suite.skip)('Windows', () => {
            const cwd = URI.file('C:\\test\\workspace');
            function t(commandLine, shell, expectedResult) {
                const options = createRewriteOptions(commandLine, cwd, shell, 1 /* OperatingSystem.Windows */);
                const result = rewriter.rewrite(options);
                strictEqual(result?.rewritten, expectedResult);
                if (expectedResult !== undefined) {
                    strictEqual(result?.reasoning, 'Removed redundant cd command');
                }
            }
            test('should ignore any trailing back slash', () => t('cd c:\\test\\workspace\\ && npm install', 'cmd', 'npm install'));
            test('should rewrite command with && separator when directory matches cwd', () => t('cd C:\\test\\workspace && npm test', 'cmd', 'npm test'));
            test('should rewrite command with ; separator when directory matches cwd - PowerShell style', () => t('cd C:\\test\\workspace; npm test', 'pwsh', 'npm test'));
            test('should not rewrite when cwd differs from cd path', () => t('cd C:\\different\\path && npm test', 'cmd', undefined));
            test('should handle case-insensitive comparison on Windows', () => t('cd c:\\test\\workspace && npm test', 'cmd', 'npm test'));
            test('should handle quoted paths', () => t('cd "C:\\test\\workspace" && npm test', 'cmd', 'npm test'));
            test('should handle cd /d flag when directory matches cwd', () => t('cd /d C:\\test\\workspace && echo hello', 'pwsh', 'echo hello'));
            test('should handle cd /d flag with quoted paths when directory matches cwd', () => t('cd /d "C:\\test\\workspace" && echo hello', 'pwsh', 'echo hello'));
            test('should not rewrite cd /d when directory does not match cwd', () => t('cd /d C:\\different\\path ; echo hello', 'pwsh', undefined));
            test('should handle cd /d flag with semicolon separator', () => t('cd /d C:\\test\\workspace; echo hello', 'pwsh', 'echo hello'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVDZFByZWZpeFJld3JpdGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL3Rlc3QvZWxlY3Ryb24tYnJvd3Nlci9jb21tYW5kTGluZUNkUHJlZml4UmV3cml0ZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxTQUFTLEVBQW1CLE1BQU0sMkNBQTJDLENBQUM7QUFDdkYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXRHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBR3JILEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7SUFDekMsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxJQUFJLG9CQUE4QyxDQUFDO0lBQ25ELElBQUksUUFBcUMsQ0FBQztJQUUxQyxTQUFTLG9CQUFvQixDQUFDLE9BQWUsRUFBRSxHQUFvQixFQUFFLEtBQWEsRUFBRSxFQUFtQjtRQUN0RyxPQUFPO1lBQ04sV0FBVyxFQUFFLE9BQU87WUFDcEIsR0FBRztZQUNILEtBQUs7WUFDTCxFQUFFO1NBQ0YsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysb0JBQW9CLEdBQUcsNkJBQTZCLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hFLFFBQVEsR0FBRyxLQUFLLENBQUMsR0FB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