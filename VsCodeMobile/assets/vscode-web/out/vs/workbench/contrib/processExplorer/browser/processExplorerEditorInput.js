/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
const processExplorerEditorIcon = registerIcon('process-explorer-editor-label-icon', Codicon.serverProcess, localize('processExplorerEditorLabelIcon', 'Icon of the process explorer editor label.'));
export class ProcessExplorerEditorInput extends EditorInput {
    constructor() {
        super(...arguments);
        this.resource = ProcessExplorerEditorInput.RESOURCE;
    }
    static { this.ID = 'workbench.editor.processExplorer'; }
    static { this.RESOURCE = URI.from({
        scheme: 'process-explorer',
        path: 'default'
    }); }
    static get instance() {
        if (!ProcessExplorerEditorInput._instance || ProcessExplorerEditorInput._instance.isDisposed()) {
            ProcessExplorerEditorInput._instance = new ProcessExplorerEditorInput();
        }
        return ProcessExplorerEditorInput._instance;
    }
    get typeId() { return ProcessExplorerEditorInput.ID; }
    get editorId() { return ProcessExplorerEditorInput.ID; }
    get capabilities() { return 2 /* EditorInputCapabilities.Readonly */ | 8 /* EditorInputCapabilities.Singleton */; }
    getName() {
        return localize('processExplorerInputName', "Process Explorer");
    }
    getIcon() {
        return processExplorerEditorIcon;
    }
    matches(other) {
        if (super.matches(other)) {
            return true;
        }
        return other instanceof ProcessExplorerEditorInput;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc0V4cGxvcmVyRWRpdG9ySW5wdXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvcHJvY2Vzc0V4cGxvcmVyL2Jyb3dzZXIvcHJvY2Vzc0V4cGxvcmVyRWRpdG9ySW5wdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVwRSxNQUFNLHlCQUF5QixHQUFHLFlBQVksQ0FBQyxvQ0FBb0MsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDLENBQUM7QUFFdE0sTUFBTSxPQUFPLDBCQUEyQixTQUFRLFdBQVc7SUFBM0Q7O1FBd0JVLGFBQVEsR0FBRywwQkFBMEIsQ0FBQyxRQUFRLENBQUM7SUFpQnpELENBQUM7YUF2Q2dCLE9BQUUsR0FBRyxrQ0FBa0MsQUFBckMsQ0FBc0M7YUFFeEMsYUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDbkMsTUFBTSxFQUFFLGtCQUFrQjtRQUMxQixJQUFJLEVBQUUsU0FBUztLQUNmLENBQUMsQUFIc0IsQ0FHckI7SUFHSCxNQUFNLEtBQUssUUFBUTtRQUNsQixJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxJQUFJLDBCQUEwQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2hHLDBCQUEwQixDQUFDLFNBQVMsR0FBRyxJQUFJLDBCQUEwQixFQUFFLENBQUM7UUFDekUsQ0FBQztRQUVELE9BQU8sMEJBQTBCLENBQUMsU0FBUyxDQUFDO0lBQzdDLENBQUM7SUFFRCxJQUFhLE1BQU0sS0FBYSxPQUFPLDBCQUEwQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFdkUsSUFBYSxRQUFRLEtBQXlCLE9BQU8sMEJBQTBCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUVyRixJQUFhLFlBQVksS0FBOEIsT0FBTyxvRkFBb0UsQ0FBQyxDQUFDLENBQUM7SUFJNUgsT0FBTztRQUNmLE9BQU8sUUFBUSxDQUFDLDBCQUEwQixFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLHlCQUF5QixDQUFDO0lBQ2xDLENBQUM7SUFFUSxPQUFPLENBQUMsS0FBd0M7UUFDeEQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsT0FBTyxLQUFLLFlBQVksMEJBQTBCLENBQUM7SUFDcEQsQ0FBQyJ9