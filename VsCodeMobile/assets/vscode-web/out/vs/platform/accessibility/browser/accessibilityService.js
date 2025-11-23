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
import { addDisposableListener } from '../../../base/browser/dom.js';
import { alert, status } from '../../../base/browser/ui/aria/aria.js';
import { mainWindow } from '../../../base/browser/window.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../common/accessibility.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IContextKeyService } from '../../contextkey/common/contextkey.js';
import { ILayoutService } from '../../layout/browser/layoutService.js';
let AccessibilityService = class AccessibilityService extends Disposable {
    constructor(_contextKeyService, _layoutService, _configurationService) {
        super();
        this._contextKeyService = _contextKeyService;
        this._layoutService = _layoutService;
        this._configurationService = _configurationService;
        this._accessibilitySupport = 0 /* AccessibilitySupport.Unknown */;
        this._onDidChangeScreenReaderOptimized = new Emitter();
        this._onDidChangeReducedMotion = new Emitter();
        this._onDidChangeLinkUnderline = new Emitter();
        this._accessibilityModeEnabledContext = CONTEXT_ACCESSIBILITY_MODE_ENABLED.bindTo(this._contextKeyService);
        const updateContextKey = () => this._accessibilityModeEnabledContext.set(this.isScreenReaderOptimized());
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('editor.accessibilitySupport')) {
                updateContextKey();
                this._onDidChangeScreenReaderOptimized.fire();
            }
            if (e.affectsConfiguration('workbench.reduceMotion')) {
                this._configMotionReduced = this._configurationService.getValue('workbench.reduceMotion');
                this._onDidChangeReducedMotion.fire();
            }
        }));
        updateContextKey();
        this._register(this.onDidChangeScreenReaderOptimized(() => updateContextKey()));
        const reduceMotionMatcher = mainWindow.matchMedia(`(prefers-reduced-motion: reduce)`);
        this._systemMotionReduced = reduceMotionMatcher.matches;
        this._configMotionReduced = this._configurationService.getValue('workbench.reduceMotion');
        this._linkUnderlinesEnabled = this._configurationService.getValue('accessibility.underlineLinks');
        this.initReducedMotionListeners(reduceMotionMatcher);
        this.initLinkUnderlineListeners();
    }
    initReducedMotionListeners(reduceMotionMatcher) {
        this._register(addDisposableListener(reduceMotionMatcher, 'change', () => {
            this._systemMotionReduced = reduceMotionMatcher.matches;
            if (this._configMotionReduced === 'auto') {
                this._onDidChangeReducedMotion.fire();
            }
        }));
        const updateRootClasses = () => {
            const reduce = this.isMotionReduced();
            this._layoutService.mainContainer.classList.toggle('monaco-reduce-motion', reduce);
            this._layoutService.mainContainer.classList.toggle('monaco-enable-motion', !reduce);
        };
        updateRootClasses();
        this._register(this.onDidChangeReducedMotion(() => updateRootClasses()));
    }
    initLinkUnderlineListeners() {
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('accessibility.underlineLinks')) {
                const linkUnderlinesEnabled = this._configurationService.getValue('accessibility.underlineLinks');
                this._linkUnderlinesEnabled = linkUnderlinesEnabled;
                this._onDidChangeLinkUnderline.fire();
            }
        }));
        const updateLinkUnderlineClasses = () => {
            const underlineLinks = this._linkUnderlinesEnabled;
            this._layoutService.mainContainer.classList.toggle('underline-links', underlineLinks);
        };
        updateLinkUnderlineClasses();
        this._register(this.onDidChangeLinkUnderlines(() => updateLinkUnderlineClasses()));
    }
    onDidChangeLinkUnderlines(listener) {
        return this._onDidChangeLinkUnderline.event(listener);
    }
    get onDidChangeScreenReaderOptimized() {
        return this._onDidChangeScreenReaderOptimized.event;
    }
    isScreenReaderOptimized() {
        const config = this._configurationService.getValue('editor.accessibilitySupport');
        return config === 'on' || (config === 'auto' && this._accessibilitySupport === 2 /* AccessibilitySupport.Enabled */);
    }
    get onDidChangeReducedMotion() {
        return this._onDidChangeReducedMotion.event;
    }
    isMotionReduced() {
        const config = this._configMotionReduced;
        return config === 'on' || (config === 'auto' && this._systemMotionReduced);
    }
    alwaysUnderlineAccessKeys() {
        return Promise.resolve(false);
    }
    getAccessibilitySupport() {
        return this._accessibilitySupport;
    }
    setAccessibilitySupport(accessibilitySupport) {
        if (this._accessibilitySupport === accessibilitySupport) {
            return;
        }
        this._accessibilitySupport = accessibilitySupport;
        this._onDidChangeScreenReaderOptimized.fire();
    }
    alert(message) {
        alert(message);
    }
    status(message) {
        status(message);
    }
};
AccessibilityService = __decorate([
    __param(0, IContextKeyService),
    __param(1, ILayoutService),
    __param(2, IConfigurationService)
], AccessibilityService);
export { AccessibilityService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjZXNzaWJpbGl0eVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDL0QsT0FBTyxFQUF3QixrQ0FBa0MsRUFBeUIsTUFBTSw0QkFBNEIsQ0FBQztBQUM3SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEUsSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBcUIsU0FBUSxVQUFVO0lBY25ELFlBQ3FCLGtCQUF1RCxFQUMzRCxjQUErQyxFQUN4QyxxQkFBK0Q7UUFFdEYsS0FBSyxFQUFFLENBQUM7UUFKNkIsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUMxQyxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDckIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQWI3RSwwQkFBcUIsd0NBQWdDO1FBQzVDLHNDQUFpQyxHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7UUFJeEQsOEJBQXlCLEdBQUcsSUFB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