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
import { IChatWidgetService } from './chat.js';
import { ChatDynamicVariableModel } from './contrib/chatDynamicVariables.js';
import { Range } from '../../../../editor/common/core/range.js';
let ChatVariablesService = class ChatVariablesService {
    constructor(chatWidgetService) {
        this.chatWidgetService = chatWidgetService;
    }
    getDynamicVariables(sessionResource) {
        // This is slightly wrong... the parser pulls dynamic references from the input widget, but there is no guarantee that message came from the input here.
        // Need to ...
        // - Parser takes list of dynamic references (annoying)
        // - Or the parser is known to implicitly act on the input widget, and we need to call it before calling the chat service (maybe incompatible with the future, but easy)
        const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
        if (!widget || !widget.viewModel || !widget.supportsFileReferences) {
            return [];
        }
        const model = widget.getContrib(ChatDynamicVariableModel.ID);
        if (!model) {
            return [];
        }
        if (widget.input.attachmentModel.attachments.length > 0 && widget.viewModel.editing) {
            const references = [];
            for (const attachment of widget.input.attachmentModel.attachments) {
                // If the attachment has a range, it is a dynamic variable
                if (attachment.range) {
                    const referenceObj = {
                        id: attachment.id,
                        fullName: attachment.name,
                        modelDescription: attachment.modelDescription,
                        range: new Range(1, attachment.range.start + 1, 1, attachment.range.endExclusive + 1),
                        icon: attachment.icon,
                        isFile: attachment.kind === 'file',
                        isDirectory: attachment.kind === 'directory',
                        data: attachment.value
                    };
                    references.push(referenceObj);
                }
            }
            return [...model.variables, ...references];
        }
        return model.variables;
    }
    getSelectedToolAndToolSets(sessionResource) {
        const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
        if (!widget) {
            return new Map();
        }
        return widget.input.selectedToolsModel.entriesMap.get();
    }
};
ChatVariablesService = __decorate([
    __param(0, IChatWidgetService)
], ChatVariablesService);
export { ChatVariablesService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZhcmlhYmxlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFZhcmlhYmxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUloRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDL0MsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0UsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3pELElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQW9CO0lBR2hDLFlBQ3NDLGlCQUFxQztRQUFyQyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO0lBQ3ZFLENBQUM7SUFFTCxtQkFBbUIsQ0FBQyxlQUFvQjtRQUN2Qyx3SkFBd0o7UUFDeEosY0FBYztRQUNkLHVEQUF1RDtRQUN2RCx3S0FBd0s7UUFDeEssTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLENBQUMsTUFBTSxDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFDcEUsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBMkIsd0JBQXdCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdkYsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JGLE1BQU0sVUFBVSxHQUF1QixFQUFFLENBQUM7WUFDMUMsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDbkUsMERBQTBEO2dCQUMxRCxJQUFJLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDdEIsTUFBTSxZQUFZLEdBQXFCO3dCQUN0QyxFQUFFLEVBQUUsVUFBVSxDQUFDLEVBQUU7d0JBQ2pCLFFBQVEsRUFBRSxVQUFVLENBQUMsSUFBSTt3QkFDekIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQjt3QkFDN0MsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQzt3QkFDckYsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO3dCQUNyQixNQUFNLEVBQUUsVUFBVSxDQUFDLElBQUksS0FBSyxNQUFNO3dCQUNsQyxXQUFXLEVBQUUsVUFBVSxDQUFDLElBQUksS0FBSyxXQUFXO3dCQUM1QyxJQUFJLEVBQUUsVUFBVSxDQUFDLEtBQUs7cUJBQ3RCLENBQUM7b0JBQ0YsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDL0IsQ0FBQztZQUNGLENBQUM7WUFFRCxPQUFPLENBQUMsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0lBRUQsMEJBQTBCLENBQUMsZUFBb0I7UUFDOUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNsQixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV6RCxDQUFDO0NBQ0QsQ0FBQTtBQXZEWSxvQkFBb0I7SUFJOUIsV0FBQSxrQkFBa0IsQ0FBQTtHQUpSLG9CQUFvQixDQXVEaEMifQ==