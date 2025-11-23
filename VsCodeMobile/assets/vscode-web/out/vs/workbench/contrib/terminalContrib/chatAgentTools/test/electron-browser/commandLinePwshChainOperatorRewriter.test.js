/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { Schemas } from '../../../../../../base/common/network.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ITreeSitterLibraryService } from '../../../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { TreeSitterLibraryService } from '../../../../../services/treeSitter/browser/treeSitterLibraryService.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { TestIPCFileSystemProvider } from '../../../../../test/electron-browser/workbenchTestServices.js';
import { CommandLinePwshChainOperatorRewriter } from '../../browser/tools/commandLineRewriter/commandLinePwshChainOperatorRewriter.js';
import { TreeSitterCommandParser } from '../../browser/treeSitterCommandParser.js';
suite('CommandLinePwshChainOperatorRewriter', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let parser;
    let rewriter;
    function createRewriteOptions(command, shell, os) {
        return {
            commandLine: command,
            cwd: undefined,
            shell,
            os
        };
    }
    setup(() => {
        const fileService = store.add(new FileService(new NullLogService()));
        const fileSystemProvider = new TestIPCFileSystemProvider();
        store.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        instantiationService = workbenchInstantiationService({
            fileService: () => fileService,
        }, store);
        const treeSitterLibraryService = store.add(instantiationService.createInstance(TreeSitterLibraryService));
        treeSitterLibraryService.isTest = true;
        instantiationService.stub(ITreeSitterLibraryService, treeSitterLibraryService);
        parser = store.add(instantiationService.createInstance(TreeSitterCommandParser));
        rewriter = store.add(instantiationService.createInstance(CommandLinePwshChainOperatorRewriter, parser));
    });
    suite('PowerShell: && -> ;', () => {
        async function t(originalCommandLine, expectedResult) {
            const options = createRewriteOptions(originalCommandLine, 'pwsh', 1 /* OperatingSystem.Windows */);
            const result = await rewriter.rewrite(options);
            strictEqual(result?.rewritten, expectedResult);
            if (expectedResult !== undefined) {
                strictEqual(result?.reasoning, '&& re-written to ;');
            }
        }
        test('should rewrite && to ; in PowerShell commands', () => t('echo hello && echo world', 'echo hello ; echo world'));
        test('should rewrite multiple && to ; in PowerShell commands', () => t('echo first && echo second && echo third', 'echo first ; echo second ; echo third'));
        test('should handle complex commands with && operators', () => t('npm install && npm test && echo "build complete"', 'npm install ; npm test ; echo "build complete"'));
        test('should work with Windows PowerShell shell identifier', () => t('Get-Process && Stop-Process', 'Get-Process ; Stop-Process'));
        test('should preserve existing semicolons', () => t('echo hello; echo world && echo final', 'echo hello; echo world ; echo final'));
        test('should not rewrite strings', () => t('echo "&&" && Write-Host "&& &&" && "&&"', 'echo "&&" ; Write-Host "&& &&" ; "&&"'));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVQd3NoQ2hhaW5PcGVyYXRvclJld3JpdGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL3Rlc3QvZWxlY3Ryb24tYnJvd3Nlci9jb21tYW5kTGluZVB3c2hDaGFpbk9wZXJhdG9yUmV3cml0ZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxpRkFBaUYsQ0FBQztBQUM1SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFckYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBQ2xILE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLGlGQUFpRixDQUFDO0FBRXZJLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRW5GLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxHQUFHLEVBQUU7SUFDbEQsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxJQUFJLG9CQUE4QyxDQUFDO0lBQ25ELElBQUksTUFBK0IsQ0FBQztJQUNwQyxJQUFJ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