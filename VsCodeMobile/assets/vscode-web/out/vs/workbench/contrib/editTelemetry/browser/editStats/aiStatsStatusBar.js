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
import { n } from '../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { createHotClass } from '../../../../../base/common/hotReloadHelpers.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { autorun, derived } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { nativeHoverDelegate } from '../../../../../platform/hover/browser/hover.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IStatusbarService } from '../../../../services/statusbar/browser/statusbar.js';
import { AI_STATS_SETTING_ID } from '../settingIds.js';
import './media.css';
let AiStatsStatusBar = class AiStatsStatusBar extends Disposable {
    static { this.hot = createHotClass(this); }
    constructor(_aiStatsFeature, _statusbarService, _commandService, _telemetryService) {
        super();
        this._aiStatsFeature = _aiStatsFeature;
        this._statusbarService = _statusbarService;
        this._commandService = _commandService;
        this._telemetryService = _telemetryService;
        this._register(autorun((reader) => {
            const statusBarItem = this._createStatusBar().keepUpdated(reader.store);
            const store = this._register(new DisposableStore());
            reader.store.add(this._statusbarService.addEntry({
                name: localize('inlineSuggestions', "Inline Suggestions"),
                ariaLabel: localize('inlineSuggestionsStatusBar', "Inline suggestions status bar"),
                text: '',
                tooltip: {
                    element: async (_token) => {
                        this._sendHoverTelemetry();
                        store.clear();
                        const elem = this._createStatusBarHover();
                        return elem.keepUpdated(store).element;
                    },
                    markdownNotSupportedFallback: undefined,
                },
                content: statusBarItem.element,
            }, 'aiStatsStatusBar', 1 /* StatusbarAlignment.RIGHT */, 100));
        }));
    }
    _sendHoverTelemetry() {
        this._telemetryService.publicLog2('aiStatsStatusBar.hover', {
            aiRate: this._aiStatsFeature.aiRate.get(),
        });
    }
    _createStatusBar() {
        return n.div({
            style: {
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '3px',
                marginRight: '3px',
            }
        }, [
            n.div({
                class: 'ai-stats-status-bar',
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    width: 50,
                    height: 6,
                    borderRadius: 6,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                }
            }, [
                n.div({
                    style: {
                        flex: 1,
                        display: 'flex',
                        overflow: 'hidden',
                        borderRadius: 6,
                        border: '1px solid transparent',
                    }
                }, [
                    n.div({
                        style: {
                            width: this._aiStatsFeature.aiRate.map(v => `${v * 100}%`),
                            backgroundColor: 'currentColor',
                        }
                    })
                ])
            ])
        ]);
    }
    _createStatusBarHover() {
        const aiRatePercent = this._aiStatsFeature.aiRate.map(r => `${Math.round(r * 100)}%`);
        return n.div({
            class: 'ai-stats-status-bar',
        }, [
            n.div({
                class: 'header',
                style: {
                    minWidth: '200px',
                }
            }, [
                n.div({ style: { flex: 1 } }, [localize('aiStatsStatusBarHeader', "AI Usage Statistics")]),
                n.div({ style: { marginLeft: 'auto' } }, actionBar([
                    {
                        action: {
                            id: 'aiStats.statusBar.settings',
                            label: '',
                            enabled: true,
                            run: () => openSettingsCommand({ ids: [AI_STATS_SETTING_ID] }).run(this._commandService),
                            class: ThemeIcon.asClassName(Codicon.gear),
                            tooltip: localize('aiStats.statusBar.configure', "Configure")
                        },
                        options: { icon: true, label: false, hoverDelegate: nativeHoverDelegate }
                    }
                ]))
            ]),
            n.div({ style: { display: 'flex' } }, [
                n.div({ style: { flex: 1, paddingRight: '4px' } }, [
                    localize('text1', "AI vs Typing Average: {0}", aiRatePercent.get()),
                ]),
                /*
                TODO: Write article that explains the ratio and link to it.

                n.div({ style: { marginLeft: 'auto' } }, actionBar([
                    {
                        action: {
                            id: 'aiStatsStatusBar.openSettings',
                            label: '',
                            enabled: true,
                            run: () => { },
                            class: ThemeIcon.asClassName(Codicon.info),
                            tooltip: ''
                        },
                        options: { icon: true, label: true, }
                    }
                ]))*/
            ]),
            n.div({ style: { flex: 1, paddingRight: '4px' } }, [
                localize('text2', "Accepted inline suggestions today: {0}", this._aiStatsFeature.acceptedInlineSuggestionsToday.get()),
            ]),
        ]);
    }
};
AiStatsStatusBar = __decorate([
    __param(1, IStatusbarService),
    __param(2, ICommandService),
    __param(3, ITelemetryService)
], AiStatsStatusBar);
export { AiStatsStatusBar };
function actionBar(actions, options) {
    return derived((_reader) => n.div({
        class: [],
        style: {},
        ref: elem => {
            const actionBar = _reader.store.add(new ActionBar(elem, options));
            for (const { action, options } of actions) {
                actionBar.push(action, options);
            }
        }
    }));
}
class CommandWithArgs {
    constructor(commandId, args = []) {
        this.commandId = commandId;
        this.args = args;
    }
    run(commandService) {
        commandService.executeCommand(this.commandId, ...this.args);
    }
}
function openSettingsCommand(options = {}) {
    return new CommandWithArgs('workbench.action.openSettings', [{
            query: options.ids ? options.ids.map(id => `@id:${id}`).join(' ') : undefined,
        }]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWlTdGF0c1N0YXR1c0Jhci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvZWRpdFN0YXRzL2FpU3RhdHNTdGF0dXNCYXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQXFDLE1BQU0sdURBQXVELENBQUM7QUFFckgsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDckYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLGlCQUFpQixFQUFzQixNQUFNLHFEQUFxRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXZELE9BQU8sYUFBYSxDQUFDO0FBRWQsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBaUIsU0FBUSxVQUFVO2FBQ3hCLFFBQUcsR0FBRyxjQUFjLENB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