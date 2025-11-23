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
import { reverseOrder, compareBy, numberComparator } from '../../../../base/common/arrays.js';
import { observableValue, observableSignalFromEvent, autorunWithStore } from '../../../../base/common/observable.js';
import { HideUnchangedRegionsFeature } from '../../../browser/widget/diffEditor/features/hideUnchangedRegionsFeature.js';
import { DisposableCancellationTokenSource } from '../../../browser/widget/diffEditor/utils.js';
import { LineRange } from '../../../common/core/ranges/lineRange.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { IOutlineModelService } from '../../documentSymbols/browser/outlineModel.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
let DiffEditorBreadcrumbsSource = class DiffEditorBreadcrumbsSource extends Disposable {
    constructor(_textModel, _languageFeaturesService, _outlineModelService) {
        super();
        this._textModel = _textModel;
        this._languageFeaturesService = _languageFeaturesService;
        this._outlineModelService = _outlineModelService;
        this._currentModel = observableValue(this, undefined);
        const documentSymbolProviderChanged = observableSignalFromEvent('documentSymbolProvider.onDidChange', this._languageFeaturesService.documentSymbolProvider.onDidChange);
        const textModelChanged = observableSignalFromEvent('_textModel.onDidChangeContent', Event.debounce(e => this._textModel.onDidChangeContent(e), () => undefined, 100));
        this._register(autorunWithStore(async (reader, store) => {
            documentSymbolProviderChanged.read(reader);
            textModelChanged.read(reader);
            const src = store.add(new DisposableCancellationTokenSource());
            const model = await this._outlineModelService.getOrCreate(this._textModel, src.token);
            if (store.isDisposed) {
                return;
            }
            this._currentModel.set(model, undefined);
        }));
    }
    getBreadcrumbItems(startRange, reader) {
        const m = this._currentModel.read(reader);
        if (!m) {
            return [];
        }
        const symbols = m.asListOfDocumentSymbols()
            .filter(s => startRange.contains(s.range.startLineNumber) && !startRange.contains(s.range.endLineNumber));
        symbols.sort(reverseOrder(compareBy(s => s.range.endLineNumber - s.range.startLineNumber, numberComparator)));
        return symbols.map(s => ({ name: s.name, kind: s.kind, startLineNumber: s.range.startLineNumber }));
    }
    getAt(lineNumber, reader) {
        const m = this._currentModel.read(reader);
        if (!m) {
            return [];
        }
        const symbols = m.asListOfDocumentSymbols()
            .filter(s => new LineRange(s.range.startLineNumber, s.range.endLineNumber).contains(lineNumber));
        if (symbols.length === 0) {
            return [];
        }
        symbols.sort(reverseOrder(compareBy(s => s.range.endLineNumber - s.range.startLineNumber, numberComparator)));
        return symbols.map(s => ({ name: s.name, kind: s.kind, startLineNumber: s.range.startLineNumber }));
    }
};
DiffEditorBreadcrumbsSource = __decorate([
    __param(1, ILanguageFeaturesService),
    __param(2, IOutlineModelService)
], DiffEditorBreadcrumbsSource);
HideUnchangedRegionsFeature.setBreadcrumbsSourceFactory((textModel, instantiationService) => {
    return instantiationService.createInstance(DiffEditorBreadcrumbsSource, textModel);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2RpZmZFZGl0b3JCcmVhZGNydW1icy9icm93c2VyL2NvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxlQUFlLEVBQUUseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQVcsTUFBTSx1Q0FBdUMsQ0FBQztBQUM5SCxPQUFPLEVBQUUsMkJBQTJCLEVBQWdDLE1BQU0sNEVBQTRFLENBQUM7QUFDdkosT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRXJFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxvQkFBb0IsRUFBZ0IsTUFBTSwrQ0FBK0MsQ0FBQztBQUNuRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBR3pELElBQU0sMkJBQTJCLEdBQWpDLE1BQU0sMkJBQTRCLFNBQVEsVUFBVTtJQUduRCxZQUNrQixVQUFzQixFQUNiLHdCQUFtRSxFQUN2RSxvQkFBMkQ7UUFFakYsS0FBSyxFQUFFLENBQUM7UUFKUyxlQUFVLEdBQVYsVUFBVSxDQUFZO1FBQ0ksNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEwQjtRQUN0RCx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXNCO1FBTGpFLGtCQUFhLEdBQUcsZUFBZSxDQUEyQixJQUFJLEVBQUUsU0FBUyxDQUFDLENB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