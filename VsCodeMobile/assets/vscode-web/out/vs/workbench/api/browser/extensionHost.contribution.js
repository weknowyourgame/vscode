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
import { registerWorkbenchContribution2 } from '../../common/contributions.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
// --- other interested parties
import { JSONValidationExtensionPoint } from '../common/jsonValidationExtensionPoint.js';
import { ColorExtensionPoint } from '../../services/themes/common/colorExtensionPoint.js';
import { IconExtensionPoint } from '../../services/themes/common/iconExtensionPoint.js';
import { TokenClassificationExtensionPoints } from '../../services/themes/common/tokenClassificationExtensionPoint.js';
import { LanguageConfigurationFileHandler } from '../../contrib/codeEditor/common/languageConfigurationExtensionPoint.js';
import { StatusBarItemsExtensionPoint } from './statusBarExtensionPoint.js';
// --- mainThread participants
import './mainThreadLocalization.js';
import './mainThreadBulkEdits.js';
import './mainThreadLanguageModels.js';
import './mainThreadChatAgents2.js';
import './mainThreadChatCodeMapper.js';
import './mainThreadLanguageModelTools.js';
import './mainThreadEmbeddings.js';
import './mainThreadCodeInsets.js';
import './mainThreadCLICommands.js';
import './mainThreadClipboard.js';
import './mainThreadCommands.js';
import './mainThreadConfiguration.js';
import './mainThreadConsole.js';
import './mainThreadDebugService.js';
import './mainThreadDecorations.js';
import './mainThreadDiagnostics.js';
import './mainThreadDialogs.js';
import './mainThreadDocumentContentProviders.js';
import './mainThreadDocuments.js';
import './mainThreadDocumentsAndEditors.js';
import './mainThreadEditor.js';
import './mainThreadEditors.js';
import './mainThreadEditorTabs.js';
import './mainThreadErrors.js';
import './mainThreadExtensionService.js';
import './mainThreadFileSystem.js';
import './mainThreadFileSystemEventService.js';
import './mainThreadLanguageFeatures.js';
import './mainThreadLanguages.js';
import './mainThreadLogService.js';
import './mainThreadMessageService.js';
import './mainThreadManagedSockets.js';
import './mainThreadOutputService.js';
import './mainThreadProgress.js';
import './mainThreadQuickDiff.js';
import './mainThreadQuickOpen.js';
import './mainThreadRemoteConnectionData.js';
import './mainThreadSaveParticipant.js';
import './mainThreadSpeech.js';
import './mainThreadEditSessionIdentityParticipant.js';
import './mainThreadSCM.js';
import './mainThreadSearch.js';
import './mainThreadStatusBar.js';
import './mainThreadStorage.js';
import './mainThreadTelemetry.js';
import './mainThreadTerminalService.js';
import './mainThreadTerminalShellIntegration.js';
import './mainThreadTheming.js';
import './mainThreadTreeViews.js';
import './mainThreadDownloadService.js';
import './mainThreadUrls.js';
import './mainThreadUriOpeners.js';
import './mainThreadWindow.js';
import './mainThreadWebviewManager.js';
import './mainThreadWorkspace.js';
import './mainThreadComments.js';
import './mainThreadNotebook.js';
import './mainThreadNotebookKernels.js';
import './mainThreadNotebookDocumentsAndEditors.js';
import './mainThreadNotebookRenderers.js';
import './mainThreadNotebookSaveParticipant.js';
import './mainThreadInteractive.js';
import './mainThreadTask.js';
import './mainThreadLabelService.js';
import './mainThreadTunnelService.js';
import './mainThreadAuthentication.js';
import './mainThreadTimeline.js';
import './mainThreadTesting.js';
import './mainThreadSecretState.js';
import './mainThreadShare.js';
import './mainThreadProfileContentHandlers.js';
import './mainThreadAiRelatedInformation.js';
import './mainThreadAiEmbeddingVector.js';
import './mainThreadAiSettingsSearch.js';
import './mainThreadMcp.js';
import './mainThreadChatContext.js';
import './mainThreadChatStatus.js';
import './mainThreadChatOutputRenderer.js';
import './mainThreadChatSessions.js';
import './mainThreadDataChannels.js';
let ExtensionPoints = class ExtensionPoints {
    static { this.ID = 'workbench.contrib.extensionPoints'; }
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
        // Classes that handle extension points...
        this.instantiationService.createInstance(JSONValidationExtensionPoint);
        this.instantiationService.createInstance(ColorExtensionPoint);
        this.instantiationService.createInstance(IconExtensionPoint);
        this.instantiationService.createInstance(TokenClassificationExtensionPoints);
        this.instantiationService.createInstance(LanguageConfigurationFileHandler);
        this.instantiationService.createInstance(StatusBarItemsExtensionPoint);
    }
};
ExtensionPoints = __decorate([
    __param(0, IInstantiationService)
], ExtensionPoints);
export { ExtensionPoints };
registerWorkbenchContribution2(ExtensionPoints.ID, ExtensionPoints, 1 /* WorkbenchPhase.BlockStartup */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL2V4dGVuc2lvbkhvc3QuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBMEMsOEJBQThCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN2SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUVoRywrQkFBK0I7QUFDL0IsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDeEYsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdkgsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFDMUgsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFNUUsOEJBQThCO0FBQzlCLE9BQU8sNkJBQTZCLENBQUM7QUFDckMsT0FBTywwQkFBMEIsQ0FBQztBQUNsQyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sNEJBQTRCLENBQUM7QUFDcEMsT0FBTywrQkFBK0IsQ0FBQztBQUN2QyxPQUFPLG1DQUFtQyxDQUFDO0FBQzNDLE9BQU8sMkJBQTJCLENBQUM7QUFDbkMsT0FBTywyQkFBMkIsQ0FBQztBQUNuQyxPQUFPLDRCQUE0QixDQUFDO0FBQ3BDLE9BQU8sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyx5QkFBeUIsQ0FBQztBQUNqQyxPQUFPLDhCQUE4QixDQUFDO0FBQ3RDLE9BQU8sd0JBQXdCLENBQUM7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