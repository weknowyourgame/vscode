/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { StringSHA1 } from '../../../../../base/common/hash.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
export var FileOperationType;
(function (FileOperationType) {
    FileOperationType["Create"] = "create";
    FileOperationType["Delete"] = "delete";
    FileOperationType["Rename"] = "rename";
    FileOperationType["TextEdit"] = "textEdit";
    FileOperationType["NotebookEdit"] = "notebookEdit";
})(FileOperationType || (FileOperationType = {}));
export function getKeyForChatSessionResource(chatSessionResource) {
    const sessionId = LocalChatSessionUri.parseLocalSessionId(chatSessionResource);
    if (sessionId) {
        return sessionId;
    }
    const sha = new StringSHA1();
    sha.update(chatSessionResource.toString());
    return sha.digest();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdPcGVyYXRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ09wZXJhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBS2hFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRTlELE1BQU0sQ0FBTixJQUFZLGlCQU1YO0FBTkQsV0FBWSxpQkFBaUI7SUFDNUIsc0NBQWlCLENBQUE7SUFDakIsc0NBQWlCLENBQUE7SUFDakIsc0NBQWlCLENBQUE7SUFDakIsMENBQXFCLENBQUE7SUFDckIsa0RBQTZCLENBQUE7QUFDOUIsQ0FBQyxFQU5XLGlCQUFpQixLQUFqQixpQkFBaUIsUUFNNUI7QUFzSEQsTUFBTSxVQUFVLDRCQUE0QixDQUFDLG1CQUF3QjtJQUNwRSxNQUFNLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQy9FLElBQUksU0FBUyxFQUFFLENBQUM7UUFDZixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztJQUM3QixHQUFHLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDM0MsT0FBTyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDckIsQ0FBQyJ9