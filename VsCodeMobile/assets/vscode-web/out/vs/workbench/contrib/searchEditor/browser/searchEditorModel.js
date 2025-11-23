/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { parseSavedSearchEditor, parseSerializedSearchEditor } from './searchEditorSerialization.js';
import { IWorkingCopyBackupService } from '../../../services/workingCopy/common/workingCopyBackup.js';
import { SearchEditorWorkingCopyTypeId } from './constants.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { createTextBufferFactoryFromStream } from '../../../../editor/common/model/textModel.js';
import { Emitter } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { SEARCH_RESULT_LANGUAGE_ID } from '../../../services/search/common/search.js';
export class SearchConfigurationModel {
    constructor(config) {
        this.config = config;
        this._onConfigDidUpdate = new Emitter();
        this.onConfigDidUpdate = this._onConfigDidUpdate.event;
    }
    updateConfig(config) { this.config = config; this._onConfigDidUpdate.fire(config); }
}
export class SearchEditorModel {
    constructor(resource) {
        this.resource = resource;
    }
    async resolve() {
        return assertReturnsDefined(searchEditorModelFactory.models.get(this.resource)).resolve();
    }
}
class SearchEditorModelFactory {
    constructor() {
        this.models = new ResourceMap();
    }
    initializeModelFromExistingModel(accessor, resource, config) {
        if (this.models.has(resource)) {
            throw Error('Unable to contruct model for resource that already exists');
        }
        const languageService = accessor.get(ILanguageService);
        const modelService = accessor.get(IModelService);
        const instantiationService = accessor.get(IInstantiationService);
        const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
        let ongoingResolve;
        this.models.set(resource, {
            resolve: () => {
                if (!ongoingResolve) {
                    ongoingResolve = (async () => {
                        const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
                        if (backup) {
                            return backup;
                        }
                        return Promise.resolve({
                            resultsModel: modelService.getModel(resource) ?? modelService.createModel('', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
                            configurationModel: new SearchConfigurationModel(config)
                        });
                    })();
                }
                return ongoingResolve;
            }
        });
    }
    initializeModelFromRawData(accessor, resource, config, contents) {
        if (this.models.has(resource)) {
            throw Error('Unable to contruct model for resource that already exists');
        }
        const languageService = accessor.get(ILanguageService);
        const modelService = accessor.get(IModelService);
        const instantiationService = accessor.get(IInstantiationService);
        const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
        let ongoingResolve;
        this.models.set(resource, {
            resolve: () => {
                if (!ongoingResolve) {
                    ongoingResolve = (async () => {
                        const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
                        if (backup) {
                            return backup;
                        }
                        return Promise.resolve({
                            resultsModel: modelService.createModel(contents ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
                            configurationModel: new SearchConfigurationModel(config)
                        });
                    })();
                }
                return ongoingResolve;
            }
        });
    }
    initializeModelFromExistingFile(accessor, resource, existingFile) {
        if (this.models.has(resource)) {
            throw Error('Unable to contruct model for resource that already exists');
        }
        const languageService = accessor.get(ILanguageService);
        const modelService = accessor.get(IModelService);
        const instantiationService = accessor.get(IInstantiationService);
        const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
        let ongoingResolve;
        this.models.set(resource, {
            resolve: async () => {
                if (!ongoingResolve) {
                    ongoingResolve = (async () => {
                        const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
                        if (backup) {
                            return backup;
                        }
                        const { text, config } = await instantiationService.invokeFunction(parseSavedSearchEditor, existingFile);
                        return ({
                            resultsModel: modelService.createModel(text ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
                            configurationModel: new SearchConfigurationModel(config)
                        });
                    })();
                }
                return ongoingResolve;
            }
        });
    }
    async tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService) {
        const backup = await workingCopyBackupService.resolve({ resource, typeId: SearchEditorWorkingCopyTypeId });
        let model = modelService.getModel(resource);
        if (!model && backup) {
            const factory = await createTextBufferFactoryFromStream(backup.value);
            model = modelService.createModel(factory, languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource);
        }
        if (model) {
            const existingFile = model.getValue();
            const { text, config } = parseSerializedSearchEditor(existingFile);
            modelService.destroyModel(resource);
            return ({
                resultsModel: modelService.createModel(text ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
                configurationModel: new SearchConfigurationModel(config)
            });
        }
        else {
            return undefined;
        }
    }
}
export const searchEditorModelFactory = new SearchEditorModelFactory();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoRWRpdG9yTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2VhcmNoRWRpdG9yL2Jyb3dzZXIvc2VhcmNoRWRpdG9yTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSw0REFBNEQsQ0FBQztBQUNySCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUN0RyxPQUFPLEVBQXVCLDZCQUE2QixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDcEYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDakcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUl0RixNQUFNLE9BQU8sd0JBQXdCO0lBSXBDLFlBQW1CLE1BQXFDO1FBQXJDLFdBQU0sR0FBTixNQUFNLENBQStCO1FBSGhELHVCQUFrQixHQUFHLElBQUksT0FBTyxFQUF1QixDQUFDO1FBQ2hELHNCQUFpQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUM7SUFFTixDQUFDO0lBQzdELFlBQVksQ0FBQyxNQUEyQixJQUFJ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