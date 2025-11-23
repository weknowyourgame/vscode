/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
export class MockPromptsService {
    constructor() {
        this._onDidChangeCustomChatModes = new Emitter();
        this.onDidChangeCustomAgents = this._onDidChangeCustomChatModes.event;
        this._customModes = [];
    }
    setCustomModes(modes) {
        this._customModes = modes;
        this._onDidChangeCustomChatModes.fire();
    }
    async getCustomAgents(token) {
        return this._customModes;
    }
    // Stub implementations for required interface methods
    getSyntaxParserFor(_model) { throw new Error('Not implemented'); }
    listPromptFiles(_type) { throw new Error('Not implemented'); }
    listPromptFilesForStorage(type, storage, token) { throw new Error('Not implemented'); }
    getSourceFolders(_type) { throw new Error('Not implemented'); }
    isValidSlashCommandName(_command) { return false; }
    resolvePromptSlashCommand(command, _token) { throw new Error('Not implemented'); }
    get onDidChangeSlashCommands() { throw new Error('Not implemented'); }
    getPromptSlashCommands(_token) { throw new Error('Not implemented'); }
    getPromptSlashCommandName(uri, _token) { throw new Error('Not implemented'); }
    parse(_uri, _type, _token) { throw new Error('Not implemented'); }
    parseNew(_uri, _token) { throw new Error('Not implemented'); }
    getParsedPromptFile(textModel) { throw new Error('Not implemented'); }
    registerContributedFile(type, name, description, uri, extension) { throw new Error('Not implemented'); }
    getPromptLocationLabel(promptPath) { throw new Error('Not implemented'); }
    findAgentMDsInWorkspace(token) { throw new Error('Not implemented'); }
    listAgentMDs(token) { throw new Error('Not implemented'); }
    listCopilotInstructionsMDs(token) { throw new Error('Not implemented'); }
    getAgentFileURIFromModeFile(oldURI) { throw new Error('Not implemented'); }
    getDisabledPromptFiles(type) { throw new Error('Method not implemented.'); }
    setDisabledPromptFiles(type, uris) { throw new Error('Method not implemented.'); }
    findClaudeSkills(token) { throw new Error('Method not implemented.'); }
    dispose() { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja1Byb21wdHNTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vbW9ja1Byb21wdHNTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQVVyRSxNQUFNLE9BQU8sa0JBQWtCO0lBQS9CO1FBSWtCLGdDQUEyQixHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7UUFDMUQsNEJBQXVCLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQztRQUVsRSxpQkFBWSxHQUFtQixFQUFFLENBQUM7SUFrQzNDLENBQUM7SUFoQ0EsY0FBYyxDQUFDLEtBQXFCO1FBQ25DLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1FBQzFCLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN6QyxDQUFDO0lBRUQsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUF3QjtRQUM3QyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDMUIsQ0FBQztJQUVELHNEQUFzRDtJQUN0RCxrQkFBa0IsQ0FBQyxNQUFXLElBQVMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RSxlQUFlLENBQUMsS0FBVSxJQUE2QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVGLHlCQUF5QixDQUFDLElBQWlCLEVBQUUsT0FBdUIsRUFBRSxLQUF3QixJQUFxQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hLLGdCQUFnQixDQUFDLEtBQVUsSUFBb0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRix1QkFBdUIsQ0FBQyxRQUFnQixJQUFhLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNwRSx5QkFBeUIsQ0FBQyxPQUFlLEVBQUUsTUFBeUIsSUFBa0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzSCxJQUFJLHdCQUF3QixLQUFrQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25GLHNCQUFzQixDQUFDLE1BQXlCLElBQW9CLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekcseUJBQXlCLENBQUMsR0FBUSxFQUFFLE1BQXlCLElBQXFCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkgsS0FBSyxDQUFDLElBQVMsRUFBRSxLQUFVLEVBQUUsTUFBeUIsSUFBa0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RyxRQUFRLENBQUMsSUFBUyxFQUFFLE1BQXlCLElBQWtCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEcsbUJBQW1CLENBQUMsU0FBcUIsSUFBc0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRyx1QkFBdUIsQ0FBQyxJQUFpQixFQUFFLElBQVksRUFBRSxXQUFtQixFQUFFLEdBQVEsRUFBRSxTQUFnQyxJQUFpQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlLLHNCQUFzQixDQUFDLFVBQXVCLElBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRix1QkFBdUIsQ0FBQyxLQUF3QixJQUFvQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pHLFlBQVksQ0FBQyxLQUF3QixJQUFvQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlGLDBCQUEwQixDQUFDLEtBQXdCLElBQW9CLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUcsMkJBQTJCLENBQUMsTUFBVyxJQUFxQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pHLHNCQUFzQixDQUFDLElBQWlCLElBQWlCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEcsc0JBQXNCLENBQUMsSUFBaUIsRUFBRSxJQUFpQixJQUFVLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEgsZ0JBQWdCLENBQUMsS0FBd0IsSUFBeUMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvSCxPQUFPLEtBQVcsQ0FBQztDQUNuQiJ9