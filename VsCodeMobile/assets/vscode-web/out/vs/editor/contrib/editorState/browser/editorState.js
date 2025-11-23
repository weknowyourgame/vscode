/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as strings from '../../../../base/common/strings.js';
import { Range } from '../../../common/core/range.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { EditorKeybindingCancellationTokenSource } from './keybindingCancellation.js';
export var CodeEditorStateFlag;
(function (CodeEditorStateFlag) {
    CodeEditorStateFlag[CodeEditorStateFlag["Value"] = 1] = "Value";
    CodeEditorStateFlag[CodeEditorStateFlag["Selection"] = 2] = "Selection";
    CodeEditorStateFlag[CodeEditorStateFlag["Position"] = 4] = "Position";
    CodeEditorStateFlag[CodeEditorStateFlag["Scroll"] = 8] = "Scroll";
})(CodeEditorStateFlag || (CodeEditorStateFlag = {}));
export class EditorState {
    constructor(editor, flags) {
        this.flags = flags;
        if ((this.flags & 1 /* CodeEditorStateFlag.Value */) !== 0) {
            const model = editor.getModel();
            this.modelVersionId = model ? strings.format('{0}#{1}', model.uri.toString(), model.getVersionId()) : null;
        }
        else {
            this.modelVersionId = null;
        }
        if ((this.flags & 4 /* CodeEditorStateFlag.Position */) !== 0) {
            this.position = editor.getPosition();
        }
        else {
            this.position = null;
        }
        if ((this.flags & 2 /* CodeEditorStateFlag.Selection */) !== 0) {
            this.selection = editor.getSelection();
        }
        else {
            this.selection = null;
        }
        if ((this.flags & 8 /* CodeEditorStateFlag.Scroll */) !== 0) {
            this.scrollLeft = editor.getScrollLeft();
            this.scrollTop = editor.getScrollTop();
        }
        else {
            this.scrollLeft = -1;
            this.scrollTop = -1;
        }
    }
    _equals(other) {
        if (!(other instanceof EditorState)) {
            return false;
        }
        const state = other;
        if (this.modelVersionId !== state.modelVersionId) {
            return false;
        }
        if (this.scrollLeft !== state.scrollLeft || this.scrollTop !== state.scrollTop) {
            return false;
        }
        if (!this.position && state.position || this.position && !state.position || this.position && state.position && !this.position.equals(state.position)) {
            return false;
        }
        if (!this.selection && state.selection || this.selection && !state.selection || this.selection && state.selection && !this.selection.equalsRange(state.selection)) {
            return false;
        }
        return true;
    }
    validate(editor) {
        return this._equals(new EditorState(editor, this.flags));
    }
}
/**
 * A cancellation token source that cancels when the editor changes as expressed
 * by the provided flags
 * @param range If provided, changes in position and selection within this range will not trigger cancellation
 */
export class EditorStateCancellationTokenSource extends EditorKeybindingCancellationTokenSource {
    constructor(editor, flags, range, parent) {
        super(editor, parent);
        this._listener = new DisposableStore();
        if (flags & 4 /* CodeEditorStateFlag.Position */) {
            this._listener.add(editor.onDidChangeCursorPosition(e => {
                if (!range || !Range.containsPosition(range, e.position)) {
                    this.cancel();
                }
            }));
        }
        if (flags & 2 /* CodeEditorStateFlag.Selection */) {
            this._listener.add(editor.onDidChangeCursorSelection(e => {
                if (!range || !Range.containsRange(range, e.selection)) {
                    this.cancel();
                }
            }));
        }
        if (flags & 8 /* CodeEditorStateFlag.Scroll */) {
            this._listener.add(editor.onDidScrollChange(_ => this.cancel()));
        }
        if (flags & 1 /* CodeEditorStateFlag.Value */) {
            this._listener.add(editor.onDidChangeModel(_ => this.cancel()));
            this._listener.add(editor.onDidChangeModelContent(_ => this.cancel()));
        }
    }
    dispose() {
        this._listener.dispose();
        super.dispose();
    }
}
/**
 * A cancellation token source that cancels when the provided model changes
 */
export class TextModelCancellationTokenSource extends CancellationTokenSource {
    constructor(model, parent) {
        super(parent);
        this._listener = model.onDidChangeContent(() => this.cancel());
    }
    dispose() {
        this._listener.dispose();
        super.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yU3RhdGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvZWRpdG9yU3RhdGUvYnJvd3Nlci9lZGl0b3JTdGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBRzlELE9BQU8sRUFBRSxLQUFLLEVBQVUsTUFBTSwrQkFBK0IsQ0FBQztBQUM5RCxPQUFPLEVBQUUsdUJBQXVCLEVBQXFCLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFlLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXBGLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXRGLE1BQU0sQ0FBTixJQUFrQixtQkFLakI7QUFMRCxXQUFrQixtQkFBbUI7SUFDcEMsK0RBQVMsQ0FBQTtJQUNULHVFQUFhLENBQUE7SUFDYixxRUFBWSxDQUFBO0lBQ1osaUVBQVUsQ0FBQTtBQUNYLENBQUMsRUFMaUIsbUJBQW1CLEtBQW5CLG1CQUFtQixRQUtwQztBQUVELE1BQU0sT0FBTyxXQUFXO0lBVXZCLFlBQVksTUFBbUIsRUFBRSxLQUFhO1FBQzdDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBRW5CLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxvQ0FBNEIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzVHLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7UUFDNUIsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyx1Q0FBK0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3RDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDdEIsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyx3Q0FBZ0MsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hELElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3hDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdkIsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxxQ0FBNkIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JELElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3hDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyQixJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLENBQUM7SUFDRixDQUFDO0lBRU8sT0FBTyxDQUFDLEtBQWM7UUFFN0IsSUFBSSxDQUFDLENBQUMsS0FBSyxZQUFZLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDckMsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBRXBCLElBQUksSUFBSSxDQUFDLGNBQWMsS0FBSyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDbEQsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEYsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN0SixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ25LLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVNLFFBQVEsQ0FBQyxNQUFtQjtRQUNsQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7Q0FDRDtBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sa0NBQW1DLFNBQVEsdUNBQXVDO0lBSTlGLFlBQVksTUFBeUIsRUFBRSxLQUEwQixFQUFFLEtBQWMsRUFBRSxNQUEwQjtRQUM1RyxLQUFLLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSE4sY0FBUyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFLbEQsSUFBSSxLQUFLLHVDQUErQixFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUN2RCxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztvQkFDMUQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNmLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNELElBQUksS0FBSyx3Q0FBZ0MsRUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDeEQsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO29CQUN4RCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2YsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsSUFBSSxLQUFLLHFDQUE2QixFQUFFLENBQUM7WUFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBQ0QsSUFBSSxLQUFLLG9DQUE0QixFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7SUFDRixDQUFDO0lBRVEsT0FBTztRQUNmLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7Q0FDRDtBQUVEOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGdDQUFpQyxTQUFRLHVCQUF1QjtJQUk1RSxZQUFZLEtBQWlCLEVBQUUsTUFBMEI7UUFDeEQsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2QsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUVRLE9BQU87UUFDZixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDO0NBQ0QifQ==