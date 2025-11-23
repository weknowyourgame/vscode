/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import * as cp from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { dirname, join } from '../../../../../base/common/path.js';
import { FileAccess } from '../../../../../base/common/network.js';
import * as util from 'util';
const exec = util.promisify(cp.exec);
suite('PolicyExport Integration Tests', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('exported policy data matches checked-in file', async function () {
        // Skip this test in ADO pipelines
        if (process.env['TF_BUILD']) {
            this.skip();
        }
        // This test launches VS Code with --export-policy-data flag, so it takes longer
        this.timeout(60000);
        // Get the repository root (FileAccess.asFileUri('') points to the 'out' directory)
        const rootPath = dirname(FileAccess.asFileUri('').fsPath);
        const checkedInFile = join(rootPath, 'build/lib/policies/policyData.jsonc');
        const tempFile = join(os.tmpdir(), `policyData-test-${Date.now()}.jsonc`);
        try {
            // Launch VS Code with --export-policy-data flag
            const scriptPath = isWindows
                ? join(rootPath, 'scripts', 'code.bat')
                : join(rootPath, 'scripts', 'code.sh');
            await exec(`"${scriptPath}" --export-policy-data="${tempFile}"`, {
                cwd: rootPath
            });
            // Read both files
            const [exportedContent, checkedInContent] = await Promise.all([
                fs.readFile(tempFile, 'utf-8'),
                fs.readFile(checkedInFile, 'utf-8')
            ]);
            // Compare contents
            assert.strictEqual(exportedContent, checkedInContent, 'Exported policy data should match the checked-in file. If this fails, run: ./scripts/code.sh --export-policy-data');
        }
        finally {
            // Clean up temp file
            try {
                await fs.unlink(tempFile);
            }
            catch {
                // Ignore cleanup errors
            }
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9saWN5RXhwb3J0LmludGVncmF0aW9uVGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wb2xpY3lFeHBvcnQvdGVzdC9ub2RlL3BvbGljeUV4cG9ydC5pbnRlZ3JhdGlvblRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxFQUFFLFFBQVEsSUFBSSxFQUFFLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDcEMsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBRTdCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRXJDLEtBQUssQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7SUFDNUMsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsOENBQThDLEVBQUUsS0FBSztRQUN6RCxrQ0FBa0M7UUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2IsQ0FBQztRQUVELGdGQUFnRjtRQUNoRixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXBCLG1GQUFtRjtRQUNuRixNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLHFDQUFxQyxDQUFDLENBQUM7UUFDNUUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxtQkFBbUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUUxRSxJQUFJLENBQUM7WUFDSixnREFBZ0Q7WUFDaEQsTUFBTSxVQUFVLEdBQUcsU0FBUztnQkFDM0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQztnQkFDdkMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRXhDLE1BQU0sSUFBSSxDQUFDLElBQUksVUFBVSwyQkFBMkIsUUFBUSxHQUFHLEVBQUU7Z0JBQ2hFLEdBQUcsRUFBRSxRQUFRO2FBQ2IsQ0FBQyxDQUFDO1lBRUgsa0JBQWtCO1lBQ2xCLE1BQU0sQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQzdELEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztnQkFDOUIsRUFBRSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDO2FBQ25DLENBQUMsQ0FBQztZQUVILG1CQUFtQjtZQUNuQixNQUFNLENBQUMsV0FBVyxDQUNqQixlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLG1IQUFtSCxDQUNuSCxDQUFDO1FBQ0gsQ0FBQztnQkFBUyxDQUFDO1lBQ1YscUJBQXFCO1lBQ3JCLElBQUksQ0FBQztnQkFDSixNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0IsQ0FBQztZQUFDLE1BQU0sQ0FBQztnQkFDUix3QkFBd0I7WUFDekIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=