/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { isNumber, isObject } from '../../../../base/common/types.js';
import { ITerminalEditorService } from './terminal.js';
let TerminalInputSerializer = class TerminalInputSerializer {
    constructor(_terminalEditorService) {
        this._terminalEditorService = _terminalEditorService;
    }
    canSerialize(editorInput) {
        return isNumber(editorInput.terminalInstance?.persistentProcessId) && editorInput.terminalInstance.shouldPersist;
    }
    serialize(editorInput) {
        if (!this.canSerialize(editorInput)) {
            return;
        }
        return JSON.stringify(this._toJson(editorInput.terminalInstance));
    }
    deserialize(instantiationService, serializedEditorInput) {
        const editorInput = JSON.parse(serializedEditorInput);
        if (!isDeserializedTerminalEditorInput(editorInput)) {
            throw new Error(`Could not revive terminal editor input, ${editorInput}`);
        }
        return this._terminalEditorService.reviveInput(editorInput);
    }
    _toJson(instance) {
        return {
            id: instance.persistentProcessId,
            pid: instance.processId || 0,
            title: instance.title,
            titleSource: instance.titleSource,
            cwd: '',
            icon: instance.icon,
            color: instance.color,
            hasChildProcesses: instance.hasChildProcesses,
            isFeatureTerminal: instance.shellLaunchConfig.isFeatureTerminal,
            hideFromUser: instance.shellLaunchConfig.hideFromUser,
            reconnectionProperties: instance.shellLaunchConfig.reconnectionProperties,
            shellIntegrationNonce: instance.shellIntegrationNonce
        };
    }
};
TerminalInputSerializer = __decorate([
    __param(0, ITerminalEditorService)
], TerminalInputSerializer);
export { TerminalInputSerializer };
function isDeserializedTerminalEditorInput(obj) {
    return isObject(obj) && 'id' in obj && 'pid' in obj;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFZGl0b3JTZXJpYWxpemVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxFZGl0b3JTZXJpYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFJdEUsT0FBTyxFQUFrQyxzQkFBc0IsRUFBNEQsTUFBTSxlQUFlLENBQUM7QUFHMUksSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBdUI7SUFDbkMsWUFDMEMsc0JBQThDO1FBQTlDLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBd0I7SUFDcEYsQ0FBQztJQUVFLFlBQVksQ0FBQyxXQUFnQztRQUNuRCxPQUFPLFFBQVEsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxXQUFXLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO0lBQ2xILENBQUM7SUFFTSxTQUFTLENBQUMsV0FBZ0M7UUFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztZQUNyQyxPQUFPO1FBQ1IsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVNLFdBQVcsQ0FBQyxvQkFBMkMsRUFBRSxxQkFBNkI7UUFDNUYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBWSxDQUFDO1FBQ2pFLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDM0UsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRU8sT0FBTyxDQUFDLFFBQTJCO1FBQzFDLE9BQU87WUFDTixFQUFFLEVBQUUsUUFBUSxDQUFDLG1CQUFvQjtZQUNqQyxHQUFHLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFBSSxDQUFDO1lBQzVCLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSztZQUNyQixXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVc7WUFDakMsR0FBRyxFQUFFLEVBQUU7WUFDUCxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7WUFDbkIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLO1lBQ3JCLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxpQkFBaUI7WUFDN0MsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQjtZQUMvRCxZQUFZLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixDQUFDLFlBQVk7WUFDckQsc0JBQXNCLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQjtZQUN6RSxxQkFBcUIsRUFBRSxRQUFRLENBQUMscUJBQXFCO1NBQ3JELENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQXhDWSx1QkFBdUI7SUFFakMsV0FBQSxzQkFBc0IsQ0FBQTtHQUZaLHVCQUF1QixDQXdDbkM7O0FBRUQsU0FBUyxpQ0FBaUMsQ0FBQyxHQUFZO0lBQ3RELE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxJQUFJLEdBQUcsQ0FBQztBQUNyRCxDQUFDIn0=