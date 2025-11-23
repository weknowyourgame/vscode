/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createCommandUri } from '../../../../../base/common/htmlContent.js';
import { escape } from '../../../../../base/common/strings.js';
import { localize } from '../../../../../nls.js';
const createSetProfileCommandUri = (profile) => createCommandUri('notebook.setProfile', { profile }).toString();
const imageSize = 400;
export default () => `
<vertically-centered>
<checklist>
	<checkbox on-checked="${createSetProfileCommandUri('default')}" checked-on="config.notebook.cellFocusIndicator == 'border' && config.notebook.insertToolbarLocation == 'both' && config.notebook.globalToolbar == false && config.notebook.compactView == true && config.notebook.showCellStatusBar == 'visible'">
		<img width="${imageSize}" src="./notebookThemes/default.png"/>
		${escape(localize('default', "Default"))}
	</checkbox>
	<checkbox on-checked="${createSetProfileCommandUri('jupyter')}" checked-on="config.notebook.cellFocusIndicator == 'gutter' && config.notebook.insertToolbarLocation == 'notebookToolbar' && config.notebook.globalToolbar == true && config.notebook.compactView == true  && config.notebook.showCellStatusBar == 'visible'">
		<img width="${imageSize}" src="./notebookThemes/jupyter.png"/>
		${escape(localize('jupyter', "Jupyter"))}
	</checkbox>
	<checkbox on-checked="${createSetProfileCommandUri('colab')}" checked-on="config.notebook.cellFocusIndicator == 'border' && config.notebook.insertToolbarLocation == 'betweenCells' && config.notebook.globalToolbar == false && config.notebook.compactView == false && config.notebook.showCellStatusBar == 'hidden'">
		<img width="${imageSize}" src="./notebookThemes/colab.png"/>
		${escape(localize('colab', "Colab"))}
	</checkbox>
</checklist>
</vertically-centered>
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tQcm9maWxlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9jb21tb24vbWVkaWEvbm90ZWJvb2tQcm9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFakQsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLE9BQWUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ3hILE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUV0QixlQUFlLEdBQUcsRUFBRSxDQUFDOzs7eUJBR0ksMEJBQTBCLENBQUMsU0FBUyxDQUFDO2dCQUM5QyxTQUFTO0lBQ3JCLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDOzt5QkFFakIsMEJBQTBCLENBQUMsU0FBUyxDQUFDO2dCQUM5QyxTQUFTO0lBQ3JCLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDOzt5QkFFakIsMEJBQTBCLENBQUMsT0FBTyxDQUFDO2dCQUM1QyxTQUFTO0lBQ3JCLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDOzs7O0NBSXJDLENBQUMifQ==