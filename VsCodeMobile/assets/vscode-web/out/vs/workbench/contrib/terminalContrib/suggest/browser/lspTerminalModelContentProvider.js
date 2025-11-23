var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LspTerminalModelContentProvider_1;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { URI } from '../../../../../base/common/uri.js';
import { Schemas } from '../../../../../base/common/network.js';
import { VSCODE_LSP_TERMINAL_PROMPT_TRACKER } from './lspTerminalUtil.js';
let LspTerminalModelContentProvider = class LspTerminalModelContentProvider extends Disposable {
    static { LspTerminalModelContentProvider_1 = this; }
    static { this.scheme = Schemas.vscodeTerminal; }
    constructor(capabilityStore, terminalId, virtualTerminalDocument, shellType, textModelService, _modelService, _languageService) {
        super();
        this._modelService = _modelService;
        this._languageService = _languageService;
        this._onCommandFinishedListener = this._register(new MutableDisposable());
        this._register(textModelService.registerTextModelContentProvider(LspTerminalModelContentProvider_1.scheme, this));
        this._capabilitiesStore = capabilityStore;
        this._commandDetection = this._capabilitiesStore.get(2 /* TerminalCapability.CommandDetection */);
        this._registerTerminalCommandFinishedListener();
        this._virtualTerminalDocumentUri = virtualTerminalDocument;
        this._shellType = shellType;
    }
    // Listens to onDidChangeShellType event from `terminal.suggest.contribution.ts`
    shellTypeChanged(shellType) {
        this._shellType = shellType;
    }
    /**
     * Sets or updates content for a terminal virtual document.
     * This is when user has executed succesful command in terminal.
     * Transfer the content to virtual document, and relocate delimiter to get terminal prompt ready for next prompt.
     */
    setContent(content) {
        const model = this._modelService.getModel(this._virtualTerminalDocumentUri);
        if (this._shellType) {
            if (model) {
                const existingContent = model.getValue();
                if (existingContent === '') {
                    model.setValue(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
                }
                else {
                    // If we are appending to existing content, remove delimiter, attach new content, and re-add delimiter
                    const delimiterIndex = existingContent.lastIndexOf(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
                    const sanitizedExistingContent = delimiterIndex !== -1 ?
                        existingContent.substring(0, delimiterIndex) :
                        existingContent;
                    const newContent = sanitizedExistingContent + '\n' + content + '\n' + VSCODE_LSP_TERMINAL_PROMPT_TRACKER;
                    model.setValue(newContent);
                }
            }
        }
    }
    /**
     * Real-time conversion of terminal input to virtual document happens here.
     * This is when user types in terminal, and we want to track the input.
     * We want to track the input and update the virtual document.
     * Note: This is for non-executed command.
    */
    trackPromptInputToVirtualFile(content) {
        this._commandDetection = this._capabilitiesStore.get(2 /* TerminalCapability.CommandDetection */);
        const model = this._modelService.getModel(this._virtualTerminalDocumentUri);
        if (this._shellType) {
            if (model) {
                const existingContent = model.getValue();
                const delimiterIndex = existingContent.lastIndexOf(VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
                // Keep content only up to delimiter
                const sanitizedExistingContent = delimiterIndex !== -1 ?
                    existingContent.substring(0, delimiterIndex) :
                    existingContent;
                // Combine base content with new content
                const newContent = sanitizedExistingContent + VSCODE_LSP_TERMINAL_PROMPT_TRACKER + content;
                model.setValue(newContent);
            }
        }
    }
    _registerTerminalCommandFinishedListener() {
        const attachListener = () => {
            if (this._onCommandFinishedListener.value) {
                return;
            }
            // Inconsistent repro: Covering case where commandDetection is available but onCommandFinished becomes available later
            if (this._commandDetection && this._commandDetection.onCommandFinished) {
                this._onCommandFinishedListener.value = this._register(this._commandDetection.onCommandFinished((e) => {
                    if (e.exitCode === 0 && this._shellType) {
                        this.setContent(e.command);
                    }
                }));
            }
        };
        attachListener();
        // Listen to onDidAddCapabilityType because command detection is not available until later
        this._register(this._capabilitiesStore.onDidAddCommandDetectionCapability(e => {
            this._commandDetection = e;
            attachListener();
        }));
    }
    async provideTextContent(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing && !existing.isDisposed()) {
            return existing;
        }
        const languageId = this._languageService.guessLanguageIdByFilepathOrFirstLine(resource);
        const languageSelection = languageId ?
            this._languageService.createById(languageId) :
            this._languageService.createById('plaintext');
        return this._modelService.createModel('', languageSelection, resource, false);
    }
};
LspTerminalModelContentProvider = LspTerminalModelContentProvider_1 = __decorate([
    __param(4, ITextModelService),
    __param(5, IModelService),
    __param(6, ILanguageService)
], LspTerminalModelContentProvider);
export { LspTerminalModelContentProvider };
/**
 * Creates a terminal language virtual URI.
 */
// TODO: Make this [OS generic](https://github.com/microsoft/vscode/issues/249477)
export function createTerminalLanguageVirtualUri(terminalId, languageExtension) {
    return URI.from({
        scheme: Schemas.vscodeTerminal,
        path: `/terminal${terminalId}.${languageExtension}`,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHNwVGVybWluYWxNb2RlbENvbnRlbnRQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL2xzcFRlcm1pbmFsTW9kZWxDb250ZW50UHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdEYsT0FBTyxFQUE2QixpQkFBaUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV4RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFHaEUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFPbkUsSUFBTSwrQkFBK0IsR0FBckMsTUFBTSwrQkFBZ0MsU0FBUSxVQUFVOzthQUM5QyxXQUFNLEdBQUcsT0FBTyxDQUFDLGNBQWMsQUFBekIsQ0FBMEI7SUFPaEQsWUFDQyxlQUF5QyxFQUN6QyxVQUFrQixFQUNsQix1QkFBNEIsRUFDNUIsU0FBd0MsRUFDckIsZ0JBQW1DLEVBQ3ZDLGFBQTZDLEVBQzFDLGdCQUFtRDtRQUdyRSxLQUFLLEVBQUUsQ0FBQztRQUp3QixrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUN6QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBVHJELCtCQUEwQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7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