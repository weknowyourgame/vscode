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
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { OutlineElement, OutlineGroup, OutlineModel } from '../../documentSymbols/browser/outlineModel.js';
import { createCancelablePromise, Delayer } from '../../../../base/common/async.js';
import { FoldingController, RangesLimitReporter } from '../../folding/browser/folding.js';
import { SyntaxRangeProvider } from '../../folding/browser/syntaxRangeProvider.js';
import { IndentRangeProvider } from '../../folding/browser/indentRangeProvider.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { StickyElement, StickyModel, StickyRange } from './stickyScrollElement.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
var ModelProvider;
(function (ModelProvider) {
    ModelProvider["OUTLINE_MODEL"] = "outlineModel";
    ModelProvider["FOLDING_PROVIDER_MODEL"] = "foldingProviderModel";
    ModelProvider["INDENTATION_MODEL"] = "indentationModel";
})(ModelProvider || (ModelProvider = {}));
var Status;
(function (Status) {
    Status[Status["VALID"] = 0] = "VALID";
    Status[Status["INVALID"] = 1] = "INVALID";
    Status[Status["CANCELED"] = 2] = "CANCELED";
})(Status || (Status = {}));
let StickyModelProvider = class StickyModelProvider extends Disposable {
    constructor(_editor, onProviderUpdate, _languageConfigurationService, _languageFeaturesService) {
        super();
        this._editor = _editor;
        this._modelProviders = [];
        this._modelPromise = null;
        this._updateScheduler = this._register(new Delayer(300));
        this._updateOperation = this._register(new DisposableStore());
        switch (this._editor.getOption(131 /* EditorOption.stickyScroll */).defaultModel) {
            case ModelProvider.OUTLINE_MODEL:
                this._modelProviders.push(new StickyModelFromCandidateOutlineProvider(this._editor, _languageFeaturesService));
            // fall through
            case ModelProvider.FOLDING_PROVIDER_MODEL:
                this._modelProviders.push(new StickyModelFromCandidateSyntaxFoldingProvider(this._editor, onProviderUpdate, _languageFeaturesService));
            // fall through
            case ModelProvider.INDENTATION_MODEL:
                this._modelProviders.push(new StickyModelFromCandidateIndentationFoldingProvider(this._editor, _languageConfigurationService));
                break;
        }
    }
    dispose() {
        this._modelProviders.forEach(provider => provider.dispose());
        this._updateOperation.clear();
        this._cancelModelPromise();
        super.dispose();
    }
    _cancelModelPromise() {
        if (this._modelPromise) {
            this._modelPromise.cancel();
            this._modelPromise = null;
        }
    }
    async update(token) {
        this._updateOperation.clear();
        this._updateOperation.add({
            dispose: () => {
                this._cancelModelPromise();
                this._updateScheduler.cancel();
            }
        });
        this._cancelModelPromise();
        return await this._updateScheduler.trigger(async () => {
            for (const modelProvider of this._modelProviders) {
                const { statusPromise, modelPromise } = modelProvider.computeStickyModel(token);
                this._modelPromise = modelPromise;
                const status = await statusPromise;
                if (this._modelPromise !== modelPromise) {
                    return null;
                }
                switch (status) {
                    case Status.CANCELED:
                        this._updateOperation.clear();
                        return null;
                    case Status.VALID:
                        return modelProvider.stickyModel;
                }
            }
            return null;
        }).catch((error) => {
            onUnexpectedError(error);
            return null;
        });
    }
};
StickyModelProvider = __decorate([
    __param(2, IInstantiationService),
    __param(3, ILanguageFeaturesService)
], StickyModelProvider);
export { StickyModelProvider };
class StickyModelCandidateProvider extends Disposable {
    constructor(_editor) {
        super();
        this._editor = _editor;
        this._stickyModel = null;
    }
    get stickyModel() {
        return this._stickyModel;
    }
    _invalid() {
        this._stickyModel = null;
        return Status.INVALID;
    }
    computeStickyModel(token) {
        if (token.isCancellationRequested || !this.isProviderValid()) {
            return { statusPromise: this._invalid(), modelPromise: null };
        }
        const providerModelPromise = createCancelablePromise(token => this.createModelFromProvider(token));
        return {
            statusPromise: providerModelPromise.then(providerModel => {
                if (!this.isModelValid(providerModel)) {
                    return this._invalid();
                }
                if (token.isCancellationRequested) {
                    return Status.CANCELED;
                }
                this._stickyModel = this.createStickyModel(token, providerModel);
                return Status.VALID;
            }).then(undefined, (err) => {
                onUnexpectedError(err);
                return Status.CANCELED;
            }),
            modelPromise: providerModelPromise
        };
    }
    /**
     * Method which checks whether the model returned by the provider is valid and can be used to compute a sticky model.
     * This method by default returns true.
     * @param model model returned by the provider
     * @returns boolean indicating whether the model is valid
     */
    isModelValid(model) {
        return true;
    }
    /**
     * Method which checks whether the provider is valid before applying it to find the provider model.
     * This method by default returns true.
     * @returns boolean indicating whether the provider is valid
     */
    isProviderValid() {
        return true;
    }
}
let StickyModelFromCandidateOutlineProvider = class StickyModelFromCandidateOutlineProvider extends StickyModelCandidateProvider {
    constructor(_editor, _languageFeaturesService) {
        super(_editor);
        this._languageFeaturesService = _languageFeaturesService;
    }
    createModelFromProvider(token) {
        return OutlineModel.create(this._languageFeaturesService.documentSymbolProvider, this._editor.getModel(), token);
    }
    createStickyModel(token, model) {
        const { stickyOutlineElement, providerID } = this._stickyModelFromOutlineModel(model, this._stickyModel?.outlineProviderId);
        const textModel = this._editor.getModel();
        return new StickyModel(textModel.uri, textModel.getVersionId(), stickyOutlineElement, providerID);
    }
    isModelValid(model) {
        return model && model.children.size > 0;
    }
    _stickyModelFromOutlineModel(outlineModel, preferredProvider) {
        let outlineElements;
        // When several possible outline providers
        if (Iterable.first(outlineModel.children.values()) instanceof OutlineGroup) {
            const provider = Iterable.find(outlineModel.children.values(), outlineGroupOfModel => outlineGroupOfModel.id === preferredProvider);
            if (provider) {
                outlineElements = provider.children;
            }
            else {
                let tempID = '';
                let maxTotalSumOfRanges = -1;
                let optimalOutlineGroup = undefined;
                for (const [_key, outlineGroup] of outlineModel.children.entries()) {
                    const totalSumRanges = this._findSumOfRangesOfGroup(outlineGroup);
                    if (totalSumRanges > maxTotalSumOfRanges) {
                        optimalOutlineGroup = outlineGroup;
                        maxTotalSumOfRanges = totalSumRanges;
                        tempID = outlineGroup.id;
                    }
                }
                preferredProvider = tempID;
                outlineElements = optimalOutlineGroup.children;
            }
        }
        else {
            outlineElements = outlineModel.children;
        }
        const stickyChildren = [];
        const outlineElementsArray = Array.from(outlineElements.values()).sort((element1, element2) => {
            const range1 = new StickyRange(element1.symbol.range.startLineNumber, element1.symbol.range.endLineNumber);
            const range2 = new StickyRange(element2.symbol.range.startLineNumber, element2.symbol.range.endLineNumber);
            return this._comparator(range1, range2);
        });
        for (const outlineElement of outlineElementsArray) {
            stickyChildren.push(this._stickyModelFromOutlineElement(outlineElement, outlineElement.symbol.selectionRange.startLineNumber));
        }
        const stickyOutlineElement = new StickyElement(undefined, stickyChildren, undefined);
        return {
            stickyOutlineElement: stickyOutlineElement,
            providerID: preferredProvider
        };
    }
    _stickyModelFromOutlineElement(outlineElement, previousStartLine) {
        const children = [];
        for (const child of outlineElement.children.values()) {
            if (child.symbol.selectionRange.startLineNumber !== child.symbol.range.endLineNumber) {
                if (child.symbol.selectionRange.startLineNumber !== previousStartLine) {
                    children.push(this._stickyModelFromOutlineElement(child, child.symbol.selectionRange.startLineNumber));
                }
                else {
                    for (const subchild of child.children.values()) {
                        children.push(this._stickyModelFromOutlineElement(subchild, child.symbol.selectionRange.startLineNumber));
                    }
                }
            }
        }
        children.sort((child1, child2) => this._comparator(child1.range, child2.range));
        const range = new StickyRange(outlineElement.symbol.selectionRange.startLineNumber, outlineElement.symbol.range.endLineNumber);
        return new StickyElement(range, children, undefined);
    }
    _comparator(range1, range2) {
        if (range1.startLineNumber !== range2.startLineNumber) {
            return range1.startLineNumber - range2.startLineNumber;
        }
        else {
            return range2.endLineNumber - range1.endLineNumber;
        }
    }
    _findSumOfRangesOfGroup(outline) {
        let res = 0;
        for (const child of outline.children.values()) {
            res += this._findSumOfRangesOfGroup(child);
        }
        if (outline instanceof OutlineElement) {
            return res + outline.symbol.range.endLineNumber - outline.symbol.selectionRange.startLineNumber;
        }
        else {
            return res;
        }
    }
};
StickyModelFromCandidateOutlineProvider = __decorate([
    __param(1, ILanguageFeaturesService)
], StickyModelFromCandidateOutlineProvider);
class StickyModelFromCandidateFoldingProvider extends StickyModelCandidateProvider {
    constructor(editor) {
        super(editor);
        this._foldingLimitReporter = this._register(new RangesLimitReporter(editor));
    }
    createStickyModel(token, model) {
        const foldingElement = this._fromFoldingRegions(model);
        const textModel = this._editor.getModel();
        return new StickyModel(textModel.uri, textModel.getVersionId(), foldingElement, undefined);
    }
    isModelValid(model) {
        return model !== null;
    }
    _fromFoldingRegions(foldingRegions) {
        const length = foldingRegions.length;
        const orderedStickyElements = [];
        // The root sticky outline element
        const stickyOutlineElement = new StickyElement(undefined, [], undefined);
        for (let i = 0; i < length; i++) {
            // Finding the parent index of the current range
            const parentIndex = foldingRegions.getParentIndex(i);
            let parentNode;
            if (parentIndex !== -1) {
                // Access the reference of the parent node
                parentNode = orderedStickyElements[parentIndex];
            }
            else {
                // In that case the parent node is the root node
                parentNode = stickyOutlineElement;
            }
            const child = new StickyElement(new StickyRange(foldingRegions.getStartLineNumber(i), foldingRegions.getEndLineNumber(i) + 1), [], parentNode);
            parentNode.children.push(child);
            orderedStickyElements.push(child);
        }
        return stickyOutlineElement;
    }
}
let StickyModelFromCandidateIndentationFoldingProvider = class StickyModelFromCandidateIndentationFoldingProvider extends StickyModelFromCandidateFoldingProvider {
    constructor(editor, _languageConfigurationService) {
        super(editor);
        this._languageConfigurationService = _languageConfigurationService;
        this.provider = this._register(new IndentRangeProvider(editor.getModel(), this._languageConfigurationService, this._foldingLimitReporter));
    }
    async createModelFromProvider(token) {
        return this.provider.compute(token);
    }
};
StickyModelFromCandidateIndentationFoldingProvider = __decorate([
    __param(1, ILanguageConfigurationService)
], StickyModelFromCandidateIndentationFoldingProvider);
let StickyModelFromCandidateSyntaxFoldingProvider = class StickyModelFromCandidateSyntaxFoldingProvider extends StickyModelFromCandidateFoldingProvider {
    constructor(editor, onProviderUpdate, _languageFeaturesService) {
        super(editor);
        this._languageFeaturesService = _languageFeaturesService;
        this.provider = this._register(new MutableDisposable());
        this._register(this._languageFeaturesService.foldingRangeProvider.onDidChange(() => {
            this._updateProvider(editor, onProviderUpdate);
        }));
        this._updateProvider(editor, onProviderUpdate);
    }
    _updateProvider(editor, onProviderUpdate) {
        const selectedProviders = FoldingController.getFoldingRangeProviders(this._languageFeaturesService, editor.getModel());
        if (selectedProviders.length === 0) {
            return;
        }
        this.provider.value = new SyntaxRangeProvider(editor.getModel(), selectedProviders, onProviderUpdate, this._foldingLimitReporter, undefined);
    }
    isProviderValid() {
        return this.provider !== undefined;
    }
    async createModelFromProvider(token) {
        return this.provider.value?.compute(token) ?? null;
    }
};
StickyModelFromCandidateSyntaxFoldingProvider = __decorate([
    __param(2, ILanguageFeaturesService)
], StickyModelFromCandidateSyntaxFoldingProvider);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RpY2t5U2Nyb2xsTW9kZWxQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9zdGlja3lTY3JvbGwvYnJvd3Nlci9zdGlja3lTY3JvbGxNb2RlbFByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbkgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDeEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFM0csT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN2RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNuRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNuRixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUUzRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNuRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFHbkcsSUFBSyxhQUlKO0FBSkQsV0FBSyxhQUFhO0lBQ2pCLCtDQUE4QixDQUFBO0lBQzlCLGdF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