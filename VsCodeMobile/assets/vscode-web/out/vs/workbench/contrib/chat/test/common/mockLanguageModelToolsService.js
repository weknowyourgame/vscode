/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ToolDataSource, ToolSet } from '../../common/languageModelToolsService.js';
export class MockLanguageModelToolsService {
    constructor() {
        this.vscodeToolSet = new ToolSet('vscode', 'vscode', ThemeIcon.fromId(Codicon.code.id), ToolDataSource.Internal);
        this.executeToolSet = new ToolSet('execute', 'execute', ThemeIcon.fromId(Codicon.terminal.id), ToolDataSource.Internal);
        this.readToolSet = new ToolSet('read', 'read', ThemeIcon.fromId(Codicon.eye.id), ToolDataSource.Internal);
        this.onDidChangeTools = Event.None;
        this.onDidPrepareToolCallBecomeUnresponsive = Event.None;
        this.toolSets = constObservable([]);
    }
    registerToolData(toolData) {
        return Disposable.None;
    }
    resetToolAutoConfirmation() {
    }
    getToolPostExecutionAutoConfirmation(toolId) {
        return 'never';
    }
    resetToolPostExecutionAutoConfirmation() {
    }
    flushToolUpdates() {
    }
    cancelToolCallsForRequest(requestId) {
    }
    setToolAutoConfirmation(toolId, scope) {
    }
    getToolAutoConfirmation(toolId) {
        return 'never';
    }
    registerToolImplementation(name, tool) {
        return Disposable.None;
    }
    registerTool(toolData, tool) {
        return Disposable.None;
    }
    getTools() {
        return [];
    }
    getTool(id) {
        return undefined;
    }
    getToolByName(name, includeDisabled) {
        return undefined;
    }
    acceptProgress(sessionId, callId, progress) {
    }
    async invokeTool(dto, countTokens, token) {
        return {
            content: [{ kind: 'text', value: 'result' }]
        };
    }
    getToolSetByName(name) {
        return undefined;
    }
    getToolSet(id) {
        return undefined;
    }
    createToolSet() {
        throw new Error('Method not implemented.');
    }
    toToolAndToolSetEnablementMap(toolOrToolSetNames) {
        throw new Error('Method not implemented.');
    }
    toToolReferences(variableReferences) {
        throw new Error('Method not implemented.');
    }
    getQualifiedToolNames() {
        throw new Error('Method not implemented.');
    }
    getToolByQualifiedName(qualifiedName) {
        throw new Error('Method not implemented.');
    }
    getQualifiedToolName(tool, set) {
        throw new Error('Method not implemented.');
    }
    toQualifiedToolNames(map) {
        throw new Error('Method not implemented.');
    }
    getDeprecatedQualifiedToolNames() {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9tb2NrTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0sMENBQTBDLENBQUM7QUFDeEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSXBFLE9BQU8sRUFBcUksY0FBYyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRXZOLE1BQU0sT0FBTyw2QkFBNkI7SUFNekM7UUFKQSxrQkFBYSxHQUFZLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNySCxtQkFBYyxHQUFZLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1SCxnQkFBVyxHQUFZLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FB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