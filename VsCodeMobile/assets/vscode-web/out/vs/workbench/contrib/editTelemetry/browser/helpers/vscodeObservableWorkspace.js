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
import { onUnexpectedError } from '../../../../../base/common/errors.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { derived, mapObservableArrayCached, observableSignalFromEvent, observableValue, transaction } from '../../../../../base/common/observable.js';
import { isDefined } from '../../../../../base/common/types.js';
import { StringText } from '../../../../../editor/common/core/text/abstractText.js';
import { offsetEditFromContentChanges } from '../../../../../editor/common/model/textModelStringEdit.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ObservableWorkspace, StringEditWithReason } from './observableWorkspace.js';
let VSCodeWorkspace = class VSCodeWorkspace extends ObservableWorkspace {
    get documents() { return this._documents; }
    constructor(_textModelService) {
        super();
        this._textModelService = _textModelService;
        this._store = new DisposableStore();
        const onModelAdded = observableSignalFromEvent(this, this._textModelService.onModelAdded);
        const onModelRemoved = observableSignalFromEvent(this, this._textModelService.onModelRemoved);
        const models = derived(this, reader => {
            onModelAdded.read(reader);
            onModelRemoved.read(reader);
            const models = this._textModelService.getModels();
            return models;
        });
        const documents = mapObservableArrayCached(this, models, (m, store) => {
            if (m.isTooLargeForSyncing()) {
                return undefined;
            }
            return store.add(new VSCodeDocument(m));
        }).recomputeInitiallyAndOnChange(this._store).map(d => d.filter(isDefined));
        this._documents = documents;
    }
    dispose() {
        this._store.dispose();
    }
};
VSCodeWorkspace = __decorate([
    __param(0, IModelService)
], VSCodeWorkspace);
export { VSCodeWorkspace };
export class VSCodeDocument extends Disposable {
    get uri() { return this.textModel.uri; }
    get value() { return this._value; }
    get version() { return this._version; }
    get languageId() { return this._languageId; }
    constructor(textModel) {
        super();
        this.textModel = textModel;
        this._value = observableValue(this, new StringText(this.textModel.getValue()));
        this._version = observableValue(this, this.textModel.getVersionId());
        this._languageId = observableValue(this, this.textModel.getLanguageId());
        this._register(this.textModel.onDidChangeContent((e) => {
            transaction(tx => {
                const edit = offsetEditFromContentChanges(e.changes);
                if (e.detailedReasons.length !== 1) {
                    onUnexpectedError(new Error(`Unexpected number of detailed reasons: ${e.detailedReasons.length}`));
                }
                const change = new StringEditWithReason(edit.replacements, e.detailedReasons[0]);
                this._value.set(new StringText(this.textModel.getValue()), tx, change);
                this._version.set(this.textModel.getVersionId(), tx);
            });
        }));
        this._register(this.textModel.onDidChangeLanguage(e => {
            transaction(tx => {
                this._languageId.set(this.textModel.getLanguageId(), tx);
            });
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnNjb2RlT2JzZXJ2YWJsZVdvcmtzcGFjZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvaGVscGVycy92c2NvZGVPYnNlcnZhYmxlV29ya3NwYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbkcsT0FBTyxFQUFFLE9BQU8sRUFBc0Msd0JBQXdCLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzFMLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVoRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFcEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDekcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBdUIsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUVuRyxJQUFNLGVBQWUsR0FBckIsTUFBTSxlQUFnQixTQUFRLG1CQUFtQjtJQUV2RCxJQUFXLFNBQVMsS0FBSyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBSWxELFlBQ2dCLGlCQUFpRDtRQUVoRSxLQUFLLEVBQUUsQ0FBQztRQUZ3QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQWU7UUFIaEQsV0FBTSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFPL0MsTUFBTSxZQUFZLEdBQUcseUJBQXlCLENBQUMsSUFB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