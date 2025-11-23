/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export const VSCODE_LSP_TERMINAL_PROMPT_TRACKER = 'vscode_lsp_terminal_prompt_tracker= {}\n';
export const terminalLspSupportedLanguages = new Set([
    {
        shellType: 'python',
        languageId: 'python',
        extension: 'py'
    }
]);
export function getTerminalLspSupportedLanguageObj(shellType) {
    for (const supportedLanguage of terminalLspSupportedLanguages) {
        if (supportedLanguage.shellType === shellType) {
            return supportedLanguage;
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHNwVGVybWluYWxVdGlsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvbHNwVGVybWluYWxVdGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE1BQU0sQ0FBQyxNQUFNLGtDQUFrQyxHQUFHLDBDQUEwQyxDQUFDO0FBRTdGLE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLElBQUksR0FBRyxDQUErRDtJQUNsSDtRQUNDLFNBQVMsRUFBRSxRQUFRO1FBQ25CLFVBQVUsRUFBRSxRQUFRO1FBQ3BCLFNBQVMsRUFBRSxJQUFJO0tBQ2Y7Q0FDRCxDQUFDLENBQUM7QUFFSCxNQUFNLFVBQVUsa0NBQWtDLENBQUMsU0FBaUI7SUFDbkUsS0FBSyxNQUFNLGlCQUFpQixJQUFJLDZCQUE2QixFQUFFLENBQUM7UUFDL0QsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDL0MsT0FBTyxpQkFBaUIsQ0FBQztRQUMxQixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sU0FBUyxDQUFDO0FBQ2xCLENBQUMifQ==