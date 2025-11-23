/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { addDisposableListener, EventHelper, EventType, getWindow } from '../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { StandardMouseEvent } from '../../../base/browser/mouseEvent.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../base/common/platform.js';
export function registerOpenEditorListeners(element, onOpenEditor) {
    const disposables = new DisposableStore();
    disposables.add(addDisposableListener(element, EventType.CLICK, e => {
        if (e.detail === 2) {
            return; // ignore double click as it is handled below
        }
        EventHelper.stop(e, true);
        onOpenEditor(toOpenEditorOptions(new StandardMouseEvent(getWindow(element), e)));
    }));
    disposables.add(addDisposableListener(element, EventType.DBLCLICK, e => {
        EventHelper.stop(e, true);
        onOpenEditor(toOpenEditorOptions(new StandardMouseEvent(getWindow(element), e), true));
    }));
    disposables.add(addDisposableListener(element, EventType.KEY_DOWN, e => {
        const options = toOpenEditorOptions(new StandardKeyboardEvent(e));
        if (!options) {
            return;
        }
        EventHelper.stop(e, true);
        onOpenEditor(options);
    }));
    return disposables;
}
export function toOpenEditorOptions(event, isDoubleClick) {
    if (event instanceof StandardKeyboardEvent) {
        let preserveFocus = undefined;
        if (event.equals(3 /* KeyCode.Enter */) || (isMacintosh && event.equals(2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */))) {
            preserveFocus = false;
        }
        else if (event.equals(10 /* KeyCode.Space */)) {
            preserveFocus = true;
        }
        if (typeof preserveFocus === 'undefined') {
            return;
        }
        return { editorOptions: { preserveFocus, pinned: !preserveFocus }, openToSide: false };
    }
    else {
        return { editorOptions: { preserveFocus: !isDoubleClick, pinned: isDoubleClick || event.middleButton }, openToSide: event.ctrlKey || event.metaKey || event.altKey };
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2VkaXRvci9icm93c2VyL2VkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUV6RSxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFDakYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBVS9ELE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxPQUFvQixFQUFFLFlBQW1EO0lBQ3BILE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFFMUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNuRSxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEIsT0FBTyxDQUFDLDZDQUE2QztRQUN0RCxDQUFDO1FBRUQsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUIsWUFBWSxDQUFDLG1CQUFtQixDQUFDLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUosV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUN0RSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUUxQixZQUFZLENBQUMsbUJBQW1CLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4RixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUosV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUN0RSxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2QsT0FBTztRQUNSLENBQUM7UUFFRCxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMxQixZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVKLE9BQU8sV0FBVyxDQUFDO0FBQ3BCLENBQUM7QUFLRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsS0FBaUQsRUFBRSxhQUF1QjtJQUM3RyxJQUFJLEtBQUssWUFBWSxxQkFBcUIsRUFBRSxDQUFDO1FBQzVDLElBQUksYUFBYSxHQUF3QixTQUFTLENBQUM7UUFDbkQsSUFBSSxLQUFLLENBQUMsTUFBTSx1QkFBZSxJQUFJLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsc0RBQWtDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDdEcsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUN2QixDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsTUFBTSx3QkFBZSxFQUFFLENBQUM7WUFDeEMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUN0QixDQUFDO1FBRUQsSUFBSSxPQUFPLGFBQWEsS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUMxQyxPQUFPO1FBQ1IsQ0FBQztRQUVELE9BQU8sRUFBRSxhQUFhLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3hGLENBQUM7U0FBTSxDQUFDO1FBQ1AsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUFFLGFBQWEsRUFBRSxDQUFDLGFBQWEsRUFBRSxNQUFNLEVBQUUsYUFBYSxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUN0SyxDQUFDO0FBQ0YsQ0FBQztBQUVELFlBQVkifQ==