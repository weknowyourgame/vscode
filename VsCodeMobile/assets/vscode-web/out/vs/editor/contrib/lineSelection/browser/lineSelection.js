/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditorAction, registerEditorAction } from '../../../browser/editorExtensions.js';
import { CursorMoveCommands } from '../../../common/cursor/cursorMoveCommands.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import * as nls from '../../../../nls.js';
export class ExpandLineSelectionAction extends EditorAction {
    constructor() {
        super({
            id: 'expandLineSelection',
            label: nls.localize2('expandLineSelection', "Expand Line Selection"),
            precondition: undefined,
            kbOpts: {
                weight: 0 /* KeybindingWeight.EditorCore */,
                kbExpr: EditorContextKeys.textInputFocus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 42 /* KeyCode.KeyL */
            },
        });
    }
    run(_accessor, editor, args) {
        args = args || {};
        if (!editor.hasModel()) {
            return;
        }
        const viewModel = editor._getViewModel();
        viewModel.model.pushStackElement();
        viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.expandLineSelection(viewModel, viewModel.getCursorStates()));
        viewModel.revealAllCursors(args.source, true);
    }
}
registerEditorAction(ExpandLineSelectionAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZVNlbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9saW5lU2VsZWN0aW9uL2Jyb3dzZXIvbGluZVNlbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsWUFBWSxFQUFFLG9CQUFvQixFQUFvQixNQUFNLHNDQUFzQyxDQUFDO0FBRTVHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFPMUMsTUFBTSxPQUFPLHlCQUEwQixTQUFRLFlBQVk7SUFDMUQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUscUJBQXFCO1lBQ3pCLEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLHFCQUFxQixFQUFFLHVCQUF1QixDQUFDO1lBQ3BFLFlBQVksRUFBRSxTQUFTO1lBQ3ZCLE1BQU0sRUFBRTtnQkFDUCxNQUFNLHFDQUE2QjtnQkFDbkMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLGNBQWM7Z0JBQ3hDLE9BQU8sRUFBRSxpREFBNkI7YUFDdEM7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU0sR0FBRyxDQUFDLFNBQTJCLEVBQUUsTUFBbUIsRUFBRSxJQUE4QjtRQUMxRixJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7WUFDeEIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDekMsU0FBUyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ25DLFNBQVMsQ0FBQyxlQUFlLENBQ3hCLElBQUksQ0FBQyxNQUFNLHVDQUVYLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FDOUUsQ0FBQztRQUNGLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7Q0FDRDtBQUVELG9CQUFvQixDQUFDLHlCQUF5QixDQUFDLENBQUMifQ==