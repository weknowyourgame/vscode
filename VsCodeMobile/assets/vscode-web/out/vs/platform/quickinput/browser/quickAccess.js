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
import { DeferredPromise } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, isDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { DefaultQuickAccessFilterValue, Extensions } from '../common/quickAccess.js';
import { IQuickInputService, ItemActivation } from '../common/quickInput.js';
import { Registry } from '../../registry/common/platform.js';
let QuickAccessController = class QuickAccessController extends Disposable {
    constructor(quickInputService, instantiationService) {
        super();
        this.quickInputService = quickInputService;
        this.instantiationService = instantiationService;
        this.registry = Registry.as(Extensions.Quickaccess);
        this.mapProviderToDescriptor = new Map();
        this.lastAcceptedPickerValues = new Map();
        this.visibleQuickAccess = undefined;
        this._register(toDisposable(() => {
            for (const provider of this.mapProviderToDescriptor.values()) {
                if (isDisposable(provider)) {
                    provider.dispose();
                }
            }
            this.visibleQuickAccess?.picker.dispose();
        }));
    }
    pick(value = '', options) {
        return this.doShowOrPick(value, true, options);
    }
    show(value = '', options) {
        this.doShowOrPick(value, false, options);
    }
    doShowOrPick(value, pick, options) {
        // Find provider for the value to show
        const [provider, descriptor] = this.getOrInstantiateProvider(value, options?.enabledProviderPrefixes);
        // Return early if quick access is already showing on that same prefix
        const visibleQuickAccess = this.visibleQuickAccess;
        const visibleDescriptor = visibleQuickAccess?.descriptor;
        if (visibleQuickAccess && descriptor && visibleDescriptor === descriptor) {
            // Apply value only if it is more specific than the prefix
            // from the provider and we are not instructed to preserve
            if (value !== descriptor.prefix && !options?.preserveValue) {
                visibleQuickAccess.picker.value = value;
            }
            // Always adjust selection
            this.adjustValueSelection(visibleQuickAccess.picker, descriptor, options);
            return;
        }
        // Rewrite the filter value based on certain rules unless disabled
        if (descriptor && !options?.preserveValue) {
            let newValue = undefined;
            // If we have a visible provider with a value, take it's filter value but
            // rewrite to new provider prefix in case they differ
            if (visibleQuickAccess && visibleDescriptor && visibleDescriptor !== descriptor) {
                const newValueCandidateWithoutPrefix = visibleQuickAccess.value.substr(visibleDescriptor.prefix.length);
                if (newValueCandidateWithoutPrefix) {
                    newValue = `${descriptor.prefix}${newValueCandidateWithoutPrefix}`;
                }
            }
            // Otherwise, take a default value as instructed
            if (!newValue) {
                const defaultFilterValue = provider?.defaultFilterValue;
                if (defaultFilterValue === DefaultQuickAccessFilterValue.LAST) {
                    newValue = this.lastAcceptedPickerValues.get(descriptor);
                }
                else if (typeof defaultFilterValue === 'string') {
                    newValue = `${descriptor.prefix}${defaultFilterValue}`;
                }
            }
            if (typeof newValue === 'string') {
                value = newValue;
            }
        }
        // Store the existing selection if there was one.
        const visibleSelection = visibleQuickAccess?.picker?.valueSelection;
        const visibleValue = visibleQuickAccess?.picker?.value;
        // Create a picker for the provider to use with the initial value
        // and adjust the filtering to exclude the prefix from filtering
        const disposables = new DisposableStore();
        const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
        picker.value = value;
        this.adjustValueSelection(picker, descriptor, options);
        picker.placeholder = options?.placeholder ?? descriptor?.placeholder;
        picker.quickNavigate = options?.quickNavigateConfiguration;
        picker.hideInput = !!picker.quickNavigate && !visibleQuickAccess; // only hide input if there was no picker opened already
        if (typeof options?.itemActivation === 'number' || options?.quickNavigateConfiguration) {
            picker.itemActivation = options?.itemActivation ?? ItemActivation.SECOND /* quick nav is always second */;
        }
        picker.contextKey = descriptor?.contextKey;
        picker.filterValue = (value) => value.substring(descriptor ? descriptor.prefix.length : 0);
        // Pick mode: setup a promise that can be resolved
        // with the selected items and prevent execution
        let pickPromise = undefined;
        if (pick) {
            pickPromise = new DeferredPromise();
            disposables.add(Event.once(picker.onWillAccept)(e => {
                e.veto();
                picker.hide();
            }));
        }
        // Register listeners
        disposables.add(this.registerPickerListeners(picker, provider, descriptor, value, options));
        // Ask provider to fill the picker as needed if we have one
        // and pass over a cancellation token that will indicate when
        // the picker is hiding without a pick being made.
        const cts = disposables.add(new CancellationTokenSource());
        if (provider) {
            disposables.add(provider.provide(picker, cts.token, options?.providerOptions));
        }
        // Finally, trigger disposal and cancellation when the picker
        // hides depending on items selected or not.
        Event.once(picker.onDidHide)(() => {
            if (picker.selectedItems.length === 0) {
                cts.cancel();
            }
            // Start to dispose once picker hides
            disposables.dispose();
            // Resolve pick promise with selected items
            pickPromise?.complete(picker.selectedItems.slice(0));
        });
        // Finally, show the picker. This is important because a provider
        // may not call this and then our disposables would leak that rely
        // on the onDidHide event.
        picker.show();
        // If the previous picker had a selection and the value is unchanged, we should set that in the new picker.
        if (visibleSelection && visibleValue === value) {
            picker.valueSelection = visibleSelection;
        }
        // Pick mode: return with promise
        if (pick) {
            return pickPromise?.p;
        }
    }
    adjustValueSelection(picker, descriptor, options) {
        let valueSelection;
        // Preserve: just always put the cursor at the end
        if (options?.preserveValue) {
            valueSelection = [picker.value.length, picker.value.length];
        }
        // Otherwise: select the value up until the prefix
        else {
            valueSelection = [descriptor?.prefix.length ?? 0, picker.value.length];
        }
        picker.valueSelection = valueSelection;
    }
    registerPickerListeners(picker, provider, descriptor, value, options) {
        const disposables = new DisposableStore();
        // Remember as last visible picker and clean up once picker get's disposed
        const visibleQuickAccess = this.visibleQuickAccess = { picker, descriptor, value };
        disposables.add(toDisposable(() => {
            if (visibleQuickAccess === this.visibleQuickAccess) {
                this.visibleQuickAccess = undefined;
            }
        }));
        // Whenever the value changes, check if the provider has
        // changed and if so - re-create the picker from the beginning
        disposables.add(picker.onDidChangeValue(value => {
            const [providerForValue] = this.getOrInstantiateProvider(value, options?.enabledProviderPrefixes);
            if (providerForValue !== provider) {
                this.show(value, {
                    enabledProviderPrefixes: options?.enabledProviderPrefixes,
                    // do not rewrite value from user typing!
                    preserveValue: true,
                    // persist the value of the providerOptions from the original showing
                    providerOptions: options?.providerOptions
                });
            }
            else {
                visibleQuickAccess.value = value; // remember the value in our visible one
            }
        }));
        // Remember picker input for future use when accepting
        if (descriptor) {
            disposables.add(picker.onDidAccept(() => {
                this.lastAcceptedPickerValues.set(descriptor, picker.value);
            }));
        }
        return disposables;
    }
    getOrInstantiateProvider(value, enabledProviderPrefixes) {
        const providerDescriptor = this.registry.getQuickAccessProvider(value);
        if (!providerDescriptor || enabledProviderPrefixes && !enabledProviderPrefixes?.includes(providerDescriptor.prefix)) {
            return [undefined, undefined];
        }
        let provider = this.mapProviderToDescriptor.get(providerDescriptor);
        if (!provider) {
            provider = this.instantiationService.createInstance(providerDescriptor.ctor);
            this.mapProviderToDescriptor.set(providerDescriptor, provider);
        }
        return [provider, providerDescriptor];
    }
};
QuickAccessController = __decorate([
    __param(0, IQuickInputService),
    __param(1, IInstantiationService)
], QuickAccessController);
export { QuickAccessController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tBY2Nlc3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3F1aWNrQWNjZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNoRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxVQUFVLEVBQTJILE1BQU0sMEJBQTBCLENBQUM7QUFDOU0sT0FBTyxFQUFFLGtCQUFrQixFQUE4QixjQUFjLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFdEQsSUFBTSxxQkFBcUIsR0FBM0IsTUFBTSxxQkFBc0IsU0FBUSxVQUFVO0lBYXBELFlBQ3FCLGlCQUFzRCxFQUNuRCxvQkFBNEQ7UUFFbkYsS0FBSyxFQUFFLENBQUM7UUFINkIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUNsQyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBYm5FLGFBQVEsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUF1QixVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDckUsNEJBQXVCLEdBQUcsSUFBSSxHQUFHLEVBQXdELENBQUM7UUFFMUYsNkJBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQTBDLENBQUM7UUFF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