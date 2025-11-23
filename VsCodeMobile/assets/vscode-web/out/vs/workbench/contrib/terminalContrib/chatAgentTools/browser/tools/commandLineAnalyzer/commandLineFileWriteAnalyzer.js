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
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { win32, posix } from '../../../../../../../base/common/path.js';
import { localize } from '../../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { isString } from '../../../../../../../base/common/types.js';
import { ILabelService } from '../../../../../../../platform/label/common/label.js';
const nullDevice = Symbol('null device');
let CommandLineFileWriteAnalyzer = class CommandLineFileWriteAnalyzer extends Disposable {
    constructor(_treeSitterCommandParser, _log, _configurationService, _labelService, _workspaceContextService) {
        super();
        this._treeSitterCommandParser = _treeSitterCommandParser;
        this._log = _log;
        this._configurationService = _configurationService;
        this._labelService = _labelService;
        this._workspaceContextService = _workspaceContextService;
    }
    async analyze(options) {
        let fileWrites;
        try {
            fileWrites = await this._getFileWrites(options);
        }
        catch (e) {
            console.error(e);
            this._log('Failed to get file writes via grammar', options.treeSitterLanguage);
            return {
                isAutoApproveAllowed: false
            };
        }
        return this._getResult(options, fileWrites);
    }
    async _getFileWrites(options) {
        let fileWrites = [];
        const capturedFileWrites = (await this._treeSitterCommandParser.getFileWrites(options.treeSitterLanguage, options.commandLine))
            .map(this._mapNullDevice.bind(this, options));
        if (capturedFileWrites.length) {
            const cwd = options.cwd;
            if (cwd) {
                this._log('Detected cwd', cwd.toString());
                fileWrites = capturedFileWrites.map(e => {
                    if (e === nullDevice) {
                        return e;
                    }
                    const isAbsolute = options.os === 1 /* OperatingSystem.Windows */ ? win32.isAbsolute(e) : posix.isAbsolute(e);
                    if (isAbsolute) {
                        return URI.file(e);
                    }
                    else {
                        return URI.joinPath(cwd, e);
                    }
                });
            }
            else {
                this._log('Cwd could not be detected');
                fileWrites = capturedFileWrites;
            }
        }
        this._log('File writes detected', fileWrites.map(e => e.toString()));
        return fileWrites;
    }
    _mapNullDevice(options, rawFileWrite) {
        if (options.treeSitterLanguage === "powershell" /* TreeSitterCommandParserLanguage.PowerShell */) {
            return rawFileWrite === '$null'
                ? nullDevice
                : rawFileWrite;
        }
        return rawFileWrite === '/dev/null'
            ? nullDevice
            : rawFileWrite;
    }
    _getResult(options, fileWrites) {
        let isAutoApproveAllowed = true;
        if (fileWrites.length > 0) {
            const blockDetectedFileWrites = this._configurationService.getValue("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */);
            switch (blockDetectedFileWrites) {
                case 'all': {
                    isAutoApproveAllowed = false;
                    this._log('File writes blocked due to "all" setting');
                    break;
                }
                case 'outsideWorkspace': {
                    const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
                    if (workspaceFolders.length > 0) {
                        for (const fileWrite of fileWrites) {
                            if (fileWrite === nullDevice) {
                                this._log('File write to null device allowed', URI.isUri(fileWrite) ? fileWrite.toString() : fileWrite);
                                continue;
                            }
                            if (isString(fileWrite)) {
                                const isAbsolute = options.os === 1 /* OperatingSystem.Windows */ ? win32.isAbsolute(fileWrite) : posix.isAbsolute(fileWrite);
                                if (!isAbsolute) {
                                    isAutoApproveAllowed = false;
                                    this._log('File write blocked due to unknown terminal cwd', fileWrite);
                                    break;
                                }
                            }
                            const fileUri = URI.isUri(fileWrite) ? fileWrite : URI.file(fileWrite);
                            // TODO: Handle command substitutions/complex destinations properly https://github.com/microsoft/vscode/issues/274167
                            // TODO: Handle environment variables properly https://github.com/microsoft/vscode/issues/274166
                            if (fileUri.fsPath.match(/[$\(\){}]/)) {
                                isAutoApproveAllowed = false;
                                this._log('File write blocked due to likely containing a variable', fileUri.toString());
                                break;
                            }
                            const isInsideWorkspace = workspaceFolders.some(folder => folder.uri.scheme === fileUri.scheme &&
                                (fileUri.path.startsWith(folder.uri.path + '/') || fileUri.path === folder.uri.path));
                            if (!isInsideWorkspace) {
                                isAutoApproveAllowed = false;
                                this._log('File write blocked outside workspace', fileUri.toString());
                                break;
                            }
                        }
                    }
                    else {
                        // No workspace folders, allow safe null device paths even without workspace
                        const hasOnlyNullDevices = fileWrites.every(fw => fw === nullDevice);
                        if (!hasOnlyNullDevices) {
                            isAutoApproveAllowed = false;
                            this._log('File writes blocked - no workspace folders');
                        }
                    }
                    break;
                }
                case 'never':
                default: {
                    break;
                }
            }
        }
        const disclaimers = [];
        if (fileWrites.length > 0) {
            const fileWritesList = fileWrites.map(fw => `\`${URI.isUri(fw) ? this._labelService.getUriLabel(fw) : fw === nullDevice ? '/dev/null' : fw.toString()}\``).join(', ');
            if (!isAutoApproveAllowed) {
                disclaimers.push(localize('runInTerminal.fileWriteBlockedDisclaimer', 'File write operations detected that cannot be auto approved: {0}', fileWritesList));
            }
            else {
                disclaimers.push(localize('runInTerminal.fileWriteDisclaimer', 'File write operations detected: {0}', fileWritesList));
            }
        }
        return {
            isAutoApproveAllowed,
            disclaimers,
        };
    }
};
CommandLineFileWriteAnalyzer = __decorate([
    __param(2, IConfigurationService),
    __param(3, ILabelService),
    __param(4, IWorkspaceContextService)
], CommandLineFileWriteAnalyzer);
export { CommandLineFileWriteAnalyzer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVGaWxlV3JpdGVBbmFseXplci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvYnJvd3Nlci90b29scy9jb21tYW5kTGluZUFuYWx5emVyL2NvbW1hbmRMaW5lRmlsZVdyaXRlQW5hbHl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUM1RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUt2RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRXBGLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUlsQyxJQUFNLDRCQUE0QixHQUFsQyxNQUFNLDRCQUE2QixTQUFRLFVBQVU7SUFDM0QsWUFDa0Isd0JBQWlELEVBQ2pELElBQW1ELEVBQzVCLHFCQUE0QyxFQUNwRCxhQUE0QixFQUNqQix3QkFBa0Q7UUFFN0YsS0FBSyxFQUFFLENBQUM7UUFOUyw2QkFBd0IsR0FBeEIsd0JBQXdCLENBQXlCO1FBQ2pELFNBQUksR0FBSixJQUFJLENBQStDO1FBQzVCLDBCQUFxQixHQUFyQixxQkFB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