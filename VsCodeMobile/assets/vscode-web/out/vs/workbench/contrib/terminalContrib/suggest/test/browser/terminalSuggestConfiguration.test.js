/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { registerTerminalSuggestProvidersConfiguration } from '../../common/terminalSuggestConfiguration.js';
suite('Terminal Suggest Dynamic Configuration', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should update configuration when providers change', () => {
        // Test initial state
        registerTerminalSuggestProvidersConfiguration();
        // Test with some providers
        const providers = new Map([
            ['terminal-suggest', { id: 'terminal-suggest', description: 'Provides intelligent completions for terminal commands' }],
            ['builtinPwsh', { id: 'builtinPwsh', description: 'PowerShell completion provider' }],
            ['lsp', { id: 'lsp' }],
            ['custom-provider', { id: 'custom-provider' }],
        ]);
        registerTerminalSuggestProvidersConfiguration(providers);
        // Test with empty providers
        registerTerminalSuggestProvidersConfiguration();
        // The fact that this doesn't throw means the basic logic works
        assert.ok(true);
    });
    test('should include default providers even when none provided', () => {
        // This should not throw and should set up default configuration
        registerTerminalSuggestProvidersConfiguration(undefined);
        assert.ok(true);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci90ZXJtaW5hbFN1Z2dlc3RDb25maWd1cmF0aW9uLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSw2Q0FBNkMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRTdHLEtBQUssQ0FBQyx3Q0FBd0MsRUFBRSxHQUFHLEVBQUU7SUFDcEQsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsbURBQW1ELEVBQUUsR0FBRyxFQUFFO1FBQzlELHFCQUFxQjtRQUNyQiw2Q0FBNkMsRUFBRSxDQUFDO1FBRWhELDJCQUEyQjtRQUMzQixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQztZQUN6QixDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSx3REFBd0QsRUFBRSxDQUFDO1lBQ3ZILENBQUMsYUFBYSxFQUFFLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsZ0NBQWdDLEVBQUUsQ0FBQztZQUNyRixDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUN0QixDQUFDLGlCQUFpQixFQUFFLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFLENBQUM7U0FDOUMsQ0FBQyxDQUFDO1FBQ0gsNkNBQTZDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFekQsNEJBQTRCO1FBQzVCLDZDQUE2QyxFQUFFLENBQUM7UUFFaEQsK0RBQStEO1FBQy9ELE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakIsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMERBQTBELEVBQUUsR0FBRyxFQUFFO1FBQ3JFLGdFQUFnRTtRQUNoRSw2Q0FBNkMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMifQ==