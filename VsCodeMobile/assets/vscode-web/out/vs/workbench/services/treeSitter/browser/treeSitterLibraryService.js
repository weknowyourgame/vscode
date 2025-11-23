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
import { ObservablePromise } from '../../../../base/common/observable.js';
import { canASAR, importAMDNodeModule } from '../../../../amdX.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService, toFileOperationResult } from '../../../../platform/files/common/files.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { CachedFunction } from '../../../../base/common/cache.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { FileAccess, nodeModulesAsarUnpackedPath, nodeModulesPath } from '../../../../base/common/network.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
export const EDITOR_EXPERIMENTAL_PREFER_TREESITTER = 'editor.experimental.preferTreeSitter';
export const TREESITTER_ALLOWED_SUPPORT = ['css', 'typescript', 'ini', 'regex'];
const MODULE_LOCATION_SUBPATH = `@vscode/tree-sitter-wasm/wasm`;
const FILENAME_TREESITTER_WASM = `tree-sitter.wasm`;
export function getModuleLocation(environmentService) {
    return `${(canASAR && environmentService.isBuilt) ? nodeModulesAsarUnpackedPath : nodeModulesPath}/${MODULE_LOCATION_SUBPATH}`;
}
let TreeSitterLibraryService = class TreeSitterLibraryService extends Disposable {
    constructor(_configurationService, _fileService, _environmentService) {
        super();
        this._configurationService = _configurationService;
        this._fileService = _fileService;
        this._environmentService = _environmentService;
        this.isTest = false;
        this._treeSitterImport = new Lazy(async () => {
            const TreeSitter = await importAMDNodeModule('@vscode/tree-sitter-wasm', 'wasm/tree-sitter.js');
            const environmentService = this._environmentService;
            const isTest = this.isTest;
            await TreeSitter.Parser.init({
                locateFile(_file, _folder) {
                    const location = `${getModuleLocation(environmentService)}/${FILENAME_TREESITTER_WASM}`;
                    if (isTest) {
                        return FileAccess.asFileUri(location).toString(true);
                    }
                    else {
                        return FileAccess.asBrowserUri(location).toString(true);
                    }
                }
            });
            return TreeSitter;
        });
        this._supportsLanguage = new CachedFunction((languageId) => {
            return observableConfigValue(`${EDITOR_EXPERIMENTAL_PREFER_TREESITTER}.${languageId}`, false, this._configurationService);
        });
        this._languagesCache = new CachedFunction((languageId) => {
            return ObservablePromise.fromFn(async () => {
                const languageLocation = getModuleLocation(this._environmentService);
                const grammarName = `tree-sitter-${languageId}`;
                const wasmPath = `${languageLocation}/${grammarName}.wasm`;
                const [treeSitter, languageFile] = await Promise.all([
                    this._treeSitterImport.value,
                    this._fileService.readFile(FileAccess.asFileUri(wasmPath))
                ]);
                const Language = treeSitter.Language;
                const language = await Language.load(languageFile.value.buffer);
                return language;
            });
        });
        this._injectionQueries = new CachedFunction({ getCacheKey: JSON.stringify }, (arg) => {
            const loadQuerySource = async () => {
                const injectionsQueriesLocation = `vs/editor/common/languages/${arg.kind}/${arg.languageId}.scm`;
                const uri = FileAccess.asFileUri(injectionsQueriesLocation);
                if (!this._fileService.hasProvider(uri)) {
                    return undefined;
                }
                const query = await tryReadFile(this._fileService, uri);
                if (query === undefined) {
                    return undefined;
                }
                return query.value.toString();
            };
            return ObservablePromise.fromFn(async () => {
                const [querySource, language, treeSitter] = await Promise.all([
                    loadQuerySource(),
                    this._languagesCache.get(arg.languageId).promise,
                    this._treeSitterImport.value,
                ]);
                if (querySource === undefined) {
                    return null;
                }
                const Query = treeSitter.Query;
                return new Query(language, querySource);
            }).resolvedValue;
        });
    }
    supportsLanguage(languageId, reader) {
        return this._supportsLanguage.get(languageId).read(reader);
    }
    async getParserClass() {
        const treeSitter = await this._treeSitterImport.value;
        return treeSitter.Parser;
    }
    getLanguage(languageId, ignoreSupportsCheck, reader) {
        if (!ignoreSupportsCheck && !this.supportsLanguage(languageId, reader)) {
            return undefined;
        }
        const lang = this._languagesCache.get(languageId).resolvedValue.read(reader);
        return lang;
    }
    async getLanguagePromise(languageId) {
        return this._languagesCache.get(languageId).promise;
    }
    getInjectionQueries(languageId, reader) {
        if (!this.supportsLanguage(languageId, reader)) {
            return undefined;
        }
        const query = this._injectionQueries.get({ languageId, kind: 'injections' }).read(reader);
        return query;
    }
    getHighlightingQueries(languageId, reader) {
        if (!this.supportsLanguage(languageId, reader)) {
            return undefined;
        }
        const query = this._injectionQueries.get({ languageId, kind: 'highlights' }).read(reader);
        return query;
    }
    async createQuery(language, querySource) {
        const treeSitter = await this._treeSitterImport.value;
        return new treeSitter.Query(language, querySource);
    }
};
TreeSitterLibraryService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IFileService),
    __param(2, IEnvironmentService)
], TreeSitterLibraryService);
export { TreeSitterLibraryService };
async function tryReadFile(fileService, uri) {
    try {
        const result = await fileService.readFile(uri);
        return result;
    }
    catch (e) {
        if (toFileOperationResult(e) === 1 /* FileOperationResult.FILE_NOT_FOUND */) {
            return undefined;
        }
        throw e;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlckxpYnJhcnlTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90cmVlU2l0dGVyL2Jyb3dzZXIvdHJlZVNpdHRlckxpYnJhcnlTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBSWhHLE9BQU8sRUFBVyxpQkFBaUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRW5GLE9BQU8sRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNuRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFxQyxZQUFZLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNwSSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUMxRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFtQixVQUFVLEVBQUUsMkJBQTJCLEVBQUUsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0gsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBR2xFLE1BQU0sQ0FBQyxNQUFNLHFDQUFxQyxHQUFHLHNDQUFzQyxDQUFDO0FBQzVGLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFFaEYsTUFBTSx1QkFBdUIsR0FBRywrQkFBK0IsQ0FBQztBQUNoRSxNQUFNLHdCQUF3QixHQUFHLGtC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