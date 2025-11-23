/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getFontSnippets } from '../../../../base/browser/fonts.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import * as nls from '../../../../nls.js';
import { Extensions as DragAndDropExtensions } from '../../../../platform/dnd/browser/dnd.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ITerminalLogService } from '../../../../platform/terminal/common/terminal.js';
import { TerminalLogService } from '../../../../platform/terminal/common/terminalLogService.js';
import { registerTerminalPlatformConfiguration } from '../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { ITerminalProfileService, TERMINAL_VIEW_ID } from '../common/terminal.js';
import { TerminalEditingService } from './terminalEditingService.js';
import { registerColors } from '../common/terminalColorRegistry.js';
import { registerTerminalConfiguration } from '../common/terminalConfiguration.js';
import { terminalStrings } from '../common/terminalStrings.js';
import './media/terminal.css';
import './media/terminalVoice.css';
import './media/widgets.css';
import './media/xterm.css';
import { RemoteTerminalBackendContribution } from './remoteTerminalBackend.js';
import { ITerminalConfigurationService, ITerminalEditingService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService, terminalEditorId } from './terminal.js';
import { registerTerminalActions } from './terminalActions.js';
import { setupTerminalCommands } from './terminalCommands.js';
import { TerminalConfigurationService } from './terminalConfigurationService.js';
import { TerminalEditor } from './terminalEditor.js';
import { TerminalEditorInput } from './terminalEditorInput.js';
import { TerminalInputSerializer } from './terminalEditorSerializer.js';
import { TerminalEditorService } from './terminalEditorService.js';
import { TerminalGroupService } from './terminalGroupService.js';
import { terminalViewIcon } from './terminalIcons.js';
import { TerminalInstanceService } from './terminalInstanceService.js';
import { TerminalMainContribution } from './terminalMainContribution.js';
import { setupTerminalMenus } from './terminalMenus.js';
import { TerminalProfileService } from './terminalProfileService.js';
import { TerminalService } from './terminalService.js';
import { TerminalTelemetryContribution } from './terminalTelemetry.js';
import { TerminalViewPane } from './terminalView.js';
// Register services
registerSingleton(ITerminalLogService, TerminalLogService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalConfigurationService, TerminalConfigurationService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalService, TerminalService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalEditorService, TerminalEditorService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalEditingService, TerminalEditingService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalGroupService, TerminalGroupService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalInstanceService, TerminalInstanceService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITerminalProfileService, TerminalProfileService, 1 /* InstantiationType.Delayed */);
// Register workbench contributions
// This contribution blocks startup as it's critical to enable the web embedder window.createTerminal API
registerWorkbenchContribution2(TerminalMainContribution.ID, TerminalMainContribution, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(RemoteTerminalBackendContribution.ID, RemoteTerminalBackendContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(TerminalTelemetryContribution.ID, TerminalTelemetryContribution, 3 /* WorkbenchPhase.AfterRestored */);
// Register configurations
registerTerminalPlatformConfiguration();
registerTerminalConfiguration(getFontSnippets);
// Register editor/dnd contributions
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(TerminalEditorInput.ID, TerminalInputSerializer);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TerminalEditor, terminalEditorId, terminalStrings.terminal), [
    new SyncDescriptor(TerminalEditorInput)
]);
Registry.as(DragAndDropExtensions.DragAndDropContribution).register({
    dataFormatKey: "Terminals" /* TerminalDataTransfers.Terminals */,
    getEditorInputs(data) {
        const editors = [];
        try {
            const terminalEditors = JSON.parse(data);
            for (const terminalEditor of terminalEditors) {
                editors.push({ resource: URI.parse(terminalEditor) });
            }
        }
        catch (error) {
            // Invalid transfer
        }
        return editors;
    },
    setData(resources, event) {
        const terminalResources = resources.filter(({ resource }) => resource.scheme === Schemas.vscodeTerminal);
        if (terminalResources.length) {
            event.dataTransfer?.setData("Terminals" /* TerminalDataTransfers.Terminals */, JSON.stringify(terminalResources.map(({ resource }) => resource.toString())));
        }
    }
});
// Register views
const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
    id: TERMINAL_VIEW_ID,
    title: nls.localize2('terminal', "Terminal"),
    icon: terminalViewIcon,
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [TERMINAL_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
    storageId: TERMINAL_VIEW_ID,
    hideIfEmpty: true,
    order: 3,
}, 1 /* ViewContainerLocation.Panel */, { doNotRegisterOpenCommand: true, isDefault: true });
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
        id: TERMINAL_VIEW_ID,
        name: nls.localize2('terminal', "Terminal"),
        containerIcon: terminalViewIcon,
        canToggleVisibility: true,
        canMoveView: true,
        ctorDescriptor: new SyncDescriptor(TerminalViewPane),
        openCommandActionDescriptor: {
            id: "workbench.action.terminal.toggleTerminal" /* TerminalCommandId.Toggle */,
            mnemonicTitle: nls.localize({ key: 'miToggleIntegratedTerminal', comment: ['&& denotes a mnemonic'] }, "&&Terminal"),
            keybindings: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 91 /* KeyCode.Backquote */,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 91 /* KeyCode.Backquote */ }
            },
            order: 3
        }
    }], VIEW_CONTAINER);
registerTerminalActions();
setupTerminalCommands();
setupTerminalMenus();
registerColors();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUVwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxxQkFBcUIsRUFBaUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM3SixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUYsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNoRyxPQUFPLEVBQUUscUNBQXFDLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUM5SCxPQUFPLEVBQUUsb0JBQW9CLEVBQXVCLE1BQU0sNEJBQTRCLENBQUM7QUFDdkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFrQiw4QkFBOEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBMEIsTUFBTSwyQkFBMkIsQ0FBQztBQUNyRixPQUFPLEVBQTJDLFVB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