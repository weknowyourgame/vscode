/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
export class BaseChatToolInvocationSubPart extends Disposable {
    static { this.idPool = 0; }
    get codeblocksPartId() {
        return this._codeBlocksPartId;
    }
    constructor(toolInvocation) {
        super();
        this.toolInvocation = toolInvocation;
        this._onNeedsRerender = this._register(new Emitter());
        this.onNeedsRerender = this._onNeedsRerender.event;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._codeBlocksPartId = 'tool-' + (BaseChatToolInvocationSubPart.idPool++);
    }
    getIcon() {
        const toolInvocation = this.toolInvocation;
        const confirmState = IChatToolInvocation.executionConfirmedOrDenied(toolInvocation);
        const isSkipped = confirmState?.type === 5 /* ToolConfirmKind.Skipped */;
        if (isSkipped) {
            return Codicon.circleSlash;
        }
        return confirmState?.type === 0 /* ToolConfirmKind.Denied */ ?
            Codicon.error :
            IChatToolInvocation.isComplete(toolInvocation) ?
                Codicon.check : ThemeIcon.modify(Codicon.loading, 'spin');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xJbnZvY2F0aW9uU3ViUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy90b29sSW52b2NhdGlvblBhcnRzL2NoYXRUb29sSW52b2NhdGlvblN1YlBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxtQkFBbUIsRUFBa0QsTUFBTSxnQ0FBZ0MsQ0FBQztBQUdySCxNQUFNLE9BQWdCLDZCQUE4QixTQUFRLFVBQVU7YUFDcEQsV0FBTSxHQUFHLENBQUMsQUFBSixDQUFLO0lBYTVCLElBQVcsZ0JBQWdCO1FBQzFCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDO0lBQy9CLENBQUM7SUFFRCxZQUNvQixjQUFtRTtRQUV0RixLQUFLLEVBQUUsQ0FBQztRQUZXLG1CQUFjLEdBQWQsY0FBYyxDQUFxRDtRQWY3RSxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRCxvQkFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7UUFFcEQsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDbkQsc0JBQWlCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQztRQUlqRCxzQkFBaUIsR0FBRyxPQUFPLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBVXhGLENBQUM7SUFFUyxPQUFPO1FBQ2hCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDM0MsTUFBTSxZQUFZLEdBQUcsbUJBQW1CLENBQUMsMEJBQTBCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDcEYsTUFBTSxTQUFTLEdBQUcsWUFBWSxFQUFFLElBQUksb0NBQTRCLENBQUM7UUFDakUsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNmLE9BQU8sT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUM1QixDQUFDO1FBRUQsT0FBTyxZQUFZLEVBQUUsSUFBSSxtQ0FBMkIsQ0FBQyxDQUFDO1lBQ3JELE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNmLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDN0QsQ0FBQyJ9