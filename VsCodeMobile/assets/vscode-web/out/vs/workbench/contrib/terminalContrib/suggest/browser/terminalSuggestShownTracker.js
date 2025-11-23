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
import { TimeoutTimer } from '../../../../../base/common/async.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
export const TERMINAL_SUGGEST_DISCOVERABILITY_KEY = 'terminal.suggest.increasedDiscoverability';
export const TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY = 'terminal.suggest.increasedDiscoverabilityCount';
const TERMINAL_SUGGEST_DISCOVERABILITY_MAX_COUNT = 10;
const TERMINAL_SUGGEST_DISCOVERABILITY_MIN_MS = 10000;
let TerminalSuggestShownTracker = class TerminalSuggestShownTracker extends Disposable {
    constructor(_shellType, _storageService, _extensionService) {
        super();
        this._shellType = _shellType;
        this._storageService = _storageService;
        this._extensionService = _extensionService;
        this._firstShownTracker = undefined;
        this._done = this._storageService.getBoolean(TERMINAL_SUGGEST_DISCOVERABILITY_KEY, -1 /* StorageScope.APPLICATION */, false);
        this._count = this._storageService.getNumber(TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY, -1 /* StorageScope.APPLICATION */, 0);
        this._register(this._extensionService.onWillStop(() => this._firstShownTracker = undefined));
    }
    get done() {
        return this._done;
    }
    resetState() {
        this._done = false;
        this._count = 0;
        this._start = undefined;
        this._firstShownTracker = undefined;
    }
    resetTimer() {
        if (this._timeout) {
            this._timeout.cancel();
            this._timeout = undefined;
        }
        this._start = undefined;
    }
    update(widgetElt) {
        if (this._done) {
            return;
        }
        this._count++;
        this._storageService.store(TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY, this._count, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        if (widgetElt && !widgetElt.classList.contains('increased-discoverability')) {
            widgetElt.classList.add('increased-discoverability');
        }
        if (this._count >= TERMINAL_SUGGEST_DISCOVERABILITY_MAX_COUNT) {
            this._setDone(widgetElt);
        }
        else if (!this._start) {
            this.resetTimer();
            this._start = Date.now();
            this._timeout = this._register(new TimeoutTimer(() => {
                this._setDone(widgetElt);
            }, TERMINAL_SUGGEST_DISCOVERABILITY_MIN_MS));
        }
    }
    _setDone(widgetElt) {
        this._done = true;
        this._storageService.store(TERMINAL_SUGGEST_DISCOVERABILITY_KEY, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        if (widgetElt) {
            widgetElt.classList.remove('increased-discoverability');
        }
        if (this._timeout) {
            this._timeout.cancel();
            this._timeout = undefined;
        }
        this._start = undefined;
    }
    getFirstShown(shellType) {
        if (!this._firstShownTracker) {
            this._firstShownTracker = {
                window: true,
                shell: new Set([shellType])
            };
            return { window: true, shell: true };
        }
        const isFirstForWindow = this._firstShownTracker.window;
        const isFirstForShell = !this._firstShownTracker.shell.has(shellType);
        if (isFirstForWindow || isFirstForShell) {
            this.updateShown();
        }
        return {
            window: isFirstForWindow,
            shell: isFirstForShell
        };
    }
    updateShown() {
        if (!this._shellType || !this._firstShownTracker) {
            return;
        }
        this._firstShownTracker.window = false;
        this._firstShownTracker.shell.add(this._shellType);
    }
};
TerminalSuggestShownTracker = __decorate([
    __param(1, IStorageService),
    __param(2, IExtensionService)
], TerminalSuggestShownTracker);
export { TerminalSuggestShownTracker };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0U2hvd25UcmFja2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvdGVybWluYWxTdWdnZXN0U2hvd25UcmFja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUVqSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUd6RixNQUFNLENBQUMsTUFBTSxvQ0FBb0MsR0FBRywyQ0FBMkMsQ0FBQztBQUNoRyxNQUFNLENBQUMsTUFBTSwwQ0FBMEMsR0FBRyxnREFBZ0QsQ0FBQztBQUMzRyxNQUFNLDBDQUEwQyxHQUFHLEVBQUUsQ0FBQztBQUN0RCxNQUFNLHVDQUF1QyxHQUFHLEtBQUssQ0FBQztBQVEvQyxJQUFNLDJCQUEyQixHQUFqQyxNQUFNLDJCQUE0QixTQUFRLFVBQVU7SUFRMUQsWUFDa0IsVUFBeUMsRUFDekMsZUFBaUQsRUFDL0MsaUJBQXFEO1FBR3hFLEtBQUssRUFBRSxDQUFDO1FBTFMsZUFBVSxHQUFWLFVBQVUsQ0FBK0I7UUFDeEIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQzlCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFMakUsdUJBQWtCLEdBQStFLFNBQVMsQ0FBQztRQVNsSCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLG9DQUFvQyxxQ0FBNEIsS0FBSyxDQUFDLENBQUM7UUFDcEgsSUFBSSxDQUFD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