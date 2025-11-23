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
import { timeout } from '../../../../../../base/common/async.js';
import { BugIndicatingError } from '../../../../../../base/common/errors.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../../base/common/lifecycle.js';
import { autorun, derived, observableValue, runOnChange, runOnChangeWithCancellationToken } from '../../../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
var UserKind;
(function (UserKind) {
    UserKind["FirstTime"] = "firstTime";
    UserKind["SecondTime"] = "secondTime";
    UserKind["Active"] = "active";
})(UserKind || (UserKind = {}));
let InlineEditsOnboardingExperience = class InlineEditsOnboardingExperience extends Disposable {
    constructor(_model, _indicator, _collapsedView, _storageService, _configurationService) {
        super();
        this._model = _model;
        this._indicator = _indicator;
        this._collapsedView = _collapsedView;
        this._storageService = _storageService;
        this._configurationService = _configurationService;
        this._disposables = this._register(new MutableDisposable());
        this._setupDone = observableValue({ name: 'setupDone' }, false);
        this._activeCompletionId = derived(reader => {
            const model = this._model.read(reader);
            if (!model) {
                return undefined;
            }
            if (!this._setupDone.read(reader)) {
                return undefined;
            }
            const indicator = this._indicator.read(reader);
            if (!indicator || !indicator.isVisible.read(reader)) {
                return undefined;
            }
            return model.inlineEdit.inlineCompletion.identity.id;
        });
        this._register(this._initializeDebugSetting());
        // Setup the onboarding experience for new users
        this._disposables.value = this.setupNewUserExperience();
        this._setupDone.set(true, undefined);
    }
    setupNewUserExperience() {
        if (this.getNewUserType() === UserKind.Active) {
            return undefined;
        }
        const disposableStore = new DisposableStore();
        let userHasHoveredOverIcon = false;
        let inlineEditHasBeenAccepted = false;
        let firstTimeUserAnimationCount = 0;
        let secondTimeUserAnimationCount = 0;
        // pulse animation for new users
        disposableStore.add(runOnChangeWithCancellationToken(this._activeCompletionId, async (id, _, __, token) => {
            if (id === undefined) {
                return;
            }
            let userType = this.getNewUserType();
            // User Kind Transition
            switch (userType) {
                case UserKind.FirstTime: {
                    if (firstTimeUserAnimationCount++ >= 5 || userHasHoveredOverIcon) {
                        userType = UserKind.SecondTime;
                        this.setNewUserType(userType);
                    }
                    break;
                }
                case UserKind.SecondTime: {
                    if (secondTimeUserAnimationCount++ >= 3 && inlineEditHasBeenAccepted) {
                        userType = UserKind.Active;
                        this.setNewUserType(userType);
                    }
                    break;
                }
            }
            // Animation
            switch (userType) {
                case UserKind.FirstTime: {
                    for (let i = 0; i < 3 && !token.isCancellationRequested; i++) {
                        await this._indicator.get()?.triggerAnimation();
                        await timeout(500);
                    }
                    break;
                }
                case UserKind.SecondTime: {
                    this._indicator.get()?.triggerAnimation();
                    break;
                }
            }
        }));
        disposableStore.add(autorun(reader => {
            if (this._collapsedView.isVisible.read(reader)) {
                if (this.getNewUserType() !== UserKind.Active) {
                    this._collapsedView.triggerAnimation();
                }
            }
        }));
        // Remember when the user has hovered over the icon
        disposableStore.add(autorun((reader) => {
            const indicator = this._indicator.read(reader);
            if (!indicator) {
                return;
            }
            reader.store.add(runOnChange(indicator.isHoveredOverIcon, async (isHovered) => {
                if (isHovered) {
                    userHasHoveredOverIcon = true;
                }
            }));
        }));
        // Remember when the user has accepted an inline edit
        disposableStore.add(autorun((reader) => {
            const model = this._model.read(reader);
            if (!model) {
                return;
            }
            reader.store.add(model.onDidAccept(() => {
                inlineEditHasBeenAccepted = true;
            }));
        }));
        return disposableStore;
    }
    getNewUserType() {
        return this._storageService.get('inlineEditsGutterIndicatorUserKind', -1 /* StorageScope.APPLICATION */, UserKind.FirstTime);
    }
    setNewUserType(value) {
        switch (value) {
            case UserKind.FirstTime:
                throw new BugIndicatingError('UserKind should not be set to first time');
            case UserKind.SecondTime:
                break;
            case UserKind.Active:
                this._disposables.clear();
                break;
        }
        this._storageService.store('inlineEditsGutterIndicatorUserKind', value, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
    }
    _initializeDebugSetting() {
        // Debug setting to reset the new user experience
        const hiddenDebugSetting = 'editor.inlineSuggest.edits.resetNewUserExperience';
        if (this._configurationService.getValue(hiddenDebugSetting)) {
            this._storageService.remove('inlineEditsGutterIndicatorUserKind', -1 /* StorageScope.APPLICATION */);
        }
        const disposable = this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(hiddenDebugSetting) && this._configurationService.getValue(hiddenDebugSetting)) {
                this._storageService.remove('inlineEditsGutterIndicatorUserKind', -1 /* StorageScope.APPLICATION */);
                this._disposables.value = this.setupNewUserExperience();
            }
        });
        return disposable;
    }
};
InlineEditsOnboardingExperience = __decorate([
    __param(3, IStorageService),
    __param(4, IConfigurationService)
], InlineEditsOnboardingExperience);
export { InlineEditsOnboardingExperience };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNOZXdVc2Vycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNOZXdVc2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN6SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBZSxlQUFlLEVBQUUsV0FBVyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUosT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxzREFBc0QsQ0FBQztBQUtwSCxJQUFLLFFBSUo7QUFKRCxXQUFLLFFBQVE7SUFDWixtQ0FBdUIsQ0FBQTtJQUN2QixxQ0FBeUIsQ0FBQTtJQUN6Qiw2QkFBaUIsQ0FBQTtBQUNsQixDQUFDLEVBSkksUUFBUSxLQUFSLFFBQVEsUUFJWjtBQUVNLElBQU0sK0JBQStCLEdBQXJDLE1BQU0sK0JBQWdDLFNBQVEsVUFBVTtJQWtCOUQsWUFDa0IsTUFBbUQsRUFDbkQsVUFBK0QsRUFDL0QsY0FBd0MsRUFDeEMsZUFBaUQsRUFDM0MscUJBQTZEO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBTlMsV0FBTSxHQUFOLE1BQU0sQ0FBNkM7UUFDbkQsZUFBVSxHQUFWLFVBQVUsQ0FBcUQ7UUFDL0QsbUJBQWMsR0FBZCxjQUFjLENBQTBCO1FBQ3ZCLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUMxQiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBckJwRSxpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFdkQsZUFBVSxHQUFHLGVBQWUsQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUzRCx3QkFBbUIsR0FBRyxPQUFPLENBQXFCLE1BQU0sQ0FBQyxFQUFFO1lBQzNFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFBQyxPQUFPLFNBQVMsQ0FBQztZQUFDLENBQUM7WUFFakMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQUMsT0FBTyxTQUFTLENBQUM7WUFBQyxDQUFDO1lBRXhELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQy9DLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUFDLE9BQU8sU0FBUyxDQUFDO1lBQUMsQ0FBQztZQUUxRSxPQUFPLEtBQUssQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUN0RCxDQUFDLENBQUMsQ0FBQztRQVdGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQztRQUUvQyxnREFBZ0Q7UUFDaEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFFeEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFTyxzQkFBc0I7UUFDN0IsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQy9DLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBRTlDLElBQUksc0JBQXNCLEdBQUcsS0FBSyxDQUFDO1FBQ25DLElBQUkseUJBQXlCLEdBQUcsS0FBSyxDQUFDO1FBQ3RDLElBQUksMkJBQTJCLEdBQUcsQ0FBQyxDQUFDO1FBQ3BDLElBQUksNEJBQTRCLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLGdDQUFnQztRQUNoQyxlQUFlLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDekcsSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQUMsT0FBTztZQUFDLENBQUM7WUFDakMsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXJDLHVCQUF1QjtZQUN2QixRQUFRLFFBQVEsRUFBRSxDQUFDO2dCQUNsQixLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUN6QixJQUFJLDJCQUEyQixFQUFFLElBQUksQ0FBQyxJQUFJLHNCQUFzQixFQUFFLENBQUM7d0JBQ2xFLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDO3dCQUMvQixJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUMvQixDQUFDO29CQUNELE1BQU07Z0JBQ1AsQ0FBQztnQkFDRCxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUMxQixJQUFJLDRCQUE0QixFQUFFLElBQUksQ0FBQyxJQUFJLHlCQUF5QixFQUFFLENBQUM7d0JBQ3RFLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDO3dCQUMzQixJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUMvQixDQUFDO29CQUNELE1BQU07Z0JBQ1AsQ0FBQztZQUNGLENBQUM7WUFFRCxZQUFZO1lBQ1osUUFBUSxRQUFRLEVBQUUsQ0FBQztnQkFDbEIsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztvQkFDekIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUM5RCxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQzt3QkFDaEQsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3BCLENBQUM7b0JBQ0QsTUFBTTtnQkFDUCxDQUFDO2dCQUNELEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDMUMsTUFBTTtnQkFDUCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixlQUFlLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNwQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUNoRCxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsS0FBSyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQy9DLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDeEMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosbURBQW1EO1FBQ25ELGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDL0MsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUFDLE9BQU87WUFBQyxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFO2dCQUM3RSxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNmLHNCQUFzQixHQUFHLElBQUksQ0FBQztnQkFDL0IsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUoscURBQXFEO1FBQ3JELGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUFDLE9BQU87WUFBQyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFO2dCQUN2Qyx5QkFBeUIsR0FBRyxJQUFJLENBQUM7WUFDbEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixPQUFPLGVBQWUsQ0FBQztJQUN4QixDQUFDO0lBRU8sY0FBYztRQUNyQixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLG9DQUFvQyxxQ0FBNEIsUUFBUSxDQUFDLFNBQVMsQ0FBYSxDQUFDO0lBQ2pJLENBQUM7SUFFTyxjQUFjLENBQUMsS0FBZTtRQUNyQyxRQUFRLEtBQUssRUFBRSxDQUFDO1lBQ2YsS0FBSyxRQUFRLENBQUMsU0FBUztnQkFDdEIsTUFBTSxJQUFJLGtCQUFrQixDQUFDLDBDQUEwQyxDQUFDLENBQUM7WUFDMUUsS0FBSyxRQUFRLENBQUMsVUFBVTtnQkFDdkIsTUFBTTtZQUNQLEtBQUssUUFBUSxDQUFDLE1BQU07Z0JBQ25CLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQzFCLE1BQU07UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsb0NBQW9DLEVBQUUsS0FBSyxnRUFBK0MsQ0FBQztJQUN2SCxDQUFDO0lBRU8sdUJBQXVCO1FBQzlCLGlEQUFpRDtRQUNqRCxNQUFNLGtCQUFrQixHQUFHLG1EQUFtRCxDQUFDO1FBQy9FLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7WUFDN0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsb0NBQW9DLG9DQUEyQixDQUFDO1FBQzdGLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDMUUsSUFBSSxDQUFDLENBQUMsb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsSUFBSSxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztnQkFDM0csSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsb0NBQW9DLG9DQUEyQixDQUFDO2dCQUM1RixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztZQUN6RCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0NBQ0QsQ0FBQTtBQXZKWSwrQkFBK0I7SUFzQnpDLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxxQkFBcUIsQ0FBQTtHQXZCWCwrQkFBK0IsQ0F1SjNDIn0=