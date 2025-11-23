/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { join } from '../../../../base/common/path.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
const MCPServerEditorIcon = registerIcon('mcp-server-editor-icon', Codicon.mcp, localize('mcpServerEditorLabelIcon', 'Icon of the MCP Server editor.'));
export class McpServerEditorInput extends EditorInput {
    static { this.ID = 'workbench.mcpServer.input2'; }
    get typeId() {
        return McpServerEditorInput.ID;
    }
    get capabilities() {
        return 2 /* EditorInputCapabilities.Readonly */ | 8 /* EditorInputCapabilities.Singleton */;
    }
    get resource() {
        return URI.from({
            scheme: Schemas.extension,
            path: join(this.mcpServer.id, 'mcpServer')
        });
    }
    constructor(_mcpServer) {
        super();
        this._mcpServer = _mcpServer;
    }
    get mcpServer() { return this._mcpServer; }
    getName() {
        return localize('extensionsInputName', "MCP Server: {0}", this._mcpServer.label);
    }
    getIcon() {
        return MCPServerEditorIcon;
    }
    matches(other) {
        if (super.matches(other)) {
            return true;
        }
        return other instanceof McpServerEditorInput && this._mcpServer.id === other._mcpServer.id;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyRWRpdG9ySW5wdXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwU2VydmVyRWRpdG9ySW5wdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUV2RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBR2pGLE1BQU0sbUJBQW1CLEdBQUcsWUFBWSxDQUFDLHdCQUF3QixFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLDBCQUEwQixFQUFFLGdDQUFnQyxDQUFDLENBQUMsQ0FBQztBQUV4SixNQUFNLE9BQU8sb0JBQXFCLFNBQVEsV0FBVzthQUVwQyxPQUFFLEdBQUcsNEJBQTRCLENBQUM7SUFFbEQsSUFBYSxNQUFNO1FBQ2xCLE9BQU8sb0JBQW9CLENBQUMsRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFhLFlBQVk7UUFDeEIsT0FBTyxvRkFBb0UsQ0FBQztJQUM3RSxDQUFDO0lBRUQsSUFBYSxRQUFRO1FBQ3BCLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztZQUNmLE1BQU0sRUFBRSxPQUFPLENBQUMsU0FBUztZQUN6QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQztTQUMxQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsWUFBb0IsVUFBK0I7UUFDbEQsS0FBSyxFQUFFLENBQUM7UUFEVyxlQUFVLEdBQVYsVUFBVSxDQUFxQjtJQUVuRCxDQUFDO0lBRUQsSUFBSSxTQUFTLEtBQTBCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFdkQsT0FBTztRQUNmLE9BQU8sUUFBUSxDQUFDLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLG1CQUFtQixDQUFDO0lBQzVCLENBQUM7SUFFUSxPQUFPLENBQUMsS0FBd0M7UUFDeEQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsT0FBTyxLQUFLLFlBQVksb0JBQW9CLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEtBQUssS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7SUFDNUYsQ0FBQyJ9