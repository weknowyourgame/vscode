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
var TerminalVoiceSession_1;
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isNumber } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SpeechTimeoutDefault } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { ISpeechService, SpeechToTextStatus } from '../../../speech/common/speechService.js';
import { alert } from '../../../../../base/browser/ui/aria/aria.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
const symbolMap = {
    'Ampersand': '&',
    'ampersand': '&',
    'Dollar': '$',
    'dollar': '$',
    'Percent': '%',
    'percent': '%',
    'Asterisk': '*',
    'asterisk': '*',
    'Plus': '+',
    'plus': '+',
    'Equals': '=',
    'equals': '=',
    'Exclamation': '!',
    'exclamation': '!',
    'Slash': '/',
    'slash': '/',
    'Backslash': '\\',
    'backslash': '\\',
    'Dot': '.',
    'dot': '.',
    'Period': '.',
    'period': '.',
    'Quote': '\'',
    'quote': '\'',
    'double quote': '"',
    'Double quote': '"',
};
let TerminalVoiceSession = class TerminalVoiceSession extends Disposable {
    static { TerminalVoiceSession_1 = this; }
    static { this._instance = undefined; }
    static getInstance(instantiationService) {
        if (!TerminalVoiceSession_1._instance) {
            TerminalVoiceSession_1._instance = instantiationService.createInstance(TerminalVoiceSession_1);
        }
        return TerminalVoiceSession_1._instance;
    }
    constructor(_speechService, _terminalService, _configurationService, contextKeyService) {
        super();
        this._speechService = _speechService;
        this._terminalService = _terminalService;
        this._configurationService = _configurationService;
        this._input = '';
        this._register(this._terminalService.onDidChangeActiveInstance(() => this.stop()));
        this._register(this._terminalService.onDidDisposeInstance(() => this.stop()));
        this._disposables = this._register(new DisposableStore());
        this._terminalDictationInProgress = TerminalContextKeys.terminalDictationInProgress.bindTo(contextKeyService);
    }
    async start() {
        this.stop();
        let voiceTimeout = this._configurationService.getValue("accessibility.voice.speechTimeout" /* AccessibilityVoiceSettingId.SpeechTimeout */);
        if (!isNumber(voiceTimeout) || voiceTimeout < 0) {
            voiceTimeout = SpeechTimeoutDefault;
        }
        this._acceptTranscriptionScheduler = this._disposables.add(new RunOnceScheduler(() => {
            this._sendText();
            this.stop();
        }, voiceTimeout));
        this._cancellationTokenSource = new CancellationTokenSource();
        this._register(toDisposable(() => this._cancellationTokenSource?.dispose(true)));
        const session = await this._speechService.createSpeechToTextSession(this._cancellationTokenSource?.token, 'terminal');
        this._disposables.add(session.onDidChange((e) => {
            if (this._cancellationTokenSource?.token.isCancellationRequested) {
                return;
            }
            switch (e.status) {
                case SpeechToTextStatus.Started:
                    this._terminalDictationInProgress.set(true);
                    if (!this._decoration) {
                        this._createDecoration();
                    }
                    break;
                case SpeechToTextStatus.Recognizing: {
                    this._updateInput(e);
                    this._renderGhostText(e);
                    this._updateDecoration();
                    if (voiceTimeout > 0) {
                        this._acceptTranscriptionScheduler.cancel();
                    }
                    break;
                }
                case SpeechToTextStatus.Recognized:
                    this._updateInput(e);
                    if (voiceTimeout > 0) {
                        this._acceptTranscriptionScheduler.schedule();
                    }
                    break;
                case SpeechToTextStatus.Stopped:
                    this.stop();
                    break;
            }
        }));
    }
    stop(send) {
        this._setInactive();
        if (send) {
            this._acceptTranscriptionScheduler.cancel();
            this._sendText();
        }
        this._ghostText = undefined;
        this._decoration?.dispose();
        this._decoration = undefined;
        this._marker?.dispose();
        this._marker = undefined;
        this._ghostTextMarker = undefined;
        this._cancellationTokenSource?.cancel();
        this._disposables.clear();
        this._input = '';
        this._terminalDictationInProgress.reset();
    }
    _sendText() {
        this._terminalService.activeInstance?.sendText(this._input, false);
        alert(localize('terminalVoiceTextInserted', '{0} inserted', this._input));
    }
    _updateInput(e) {
        if (e.text) {
            let input = e.text.replaceAll(/[.,?;!]/g, '');
            for (const symbol of Object.entries(symbolMap)) {
                input = input.replace(new RegExp('\\b' + symbol[0] + '\\b'), symbol[1]);
            }
            this._input = ' ' + input;
        }
    }
    _createDecoration() {
        const activeInstance = this._terminalService.activeInstance;
        const xterm = activeInstance?.xterm?.raw;
        if (!xterm) {
            return;
        }
        const onFirstLine = xterm.buffer.active.cursorY === 0;
        // Calculate x position based on current cursor position and input length
        const inputLength = this._input.length;
        const xPosition = xterm.buffer.active.cursorX + inputLength;
        this._marker = activeInstance.registerMarker(onFirstLine ? 0 : -1);
        if (!this._marker) {
            return;
        }
        this._decoration = xterm.registerDecoration({
            marker: this._marker,
            layer: 'top',
            x: xPosition,
        });
        if (!this._decoration) {
            this._marker.dispose();
            this._marker = undefined;
            return;
        }
        this._decoration.onRender((e) => {
            e.classList.add(...ThemeIcon.asClassNameArray(Codicon.micFilled), 'terminal-voice', 'recording');
            e.style.transform = onFirstLine ? 'translate(10px, -2px)' : 'translate(-6px, -5px)';
        });
    }
    _updateDecoration() {
        // Dispose the old decoration and recreate it at the new position
        this._decoration?.dispose();
        this._marker?.dispose();
        this._decoration = undefined;
        this._marker = undefined;
        this._createDecoration();
    }
    _setInactive() {
        this._decoration?.element?.classList.remove('recording');
    }
    _renderGhostText(e) {
        this._ghostText?.dispose();
        const text = e.text;
        if (!text) {
            return;
        }
        const activeInstance = this._terminalService.activeInstance;
        const xterm = activeInstance?.xterm?.raw;
        if (!xterm) {
            return;
        }
        this._ghostTextMarker = activeInstance.registerMarker();
        if (!this._ghostTextMarker) {
            return;
        }
        this._disposables.add(this._ghostTextMarker);
        const onFirstLine = xterm.buffer.active.cursorY === 0;
        this._ghostText = xterm.registerDecoration({
            marker: this._ghostTextMarker,
            layer: 'top',
            x: onFirstLine ? xterm.buffer.active.cursorX + 4 : xterm.buffer.active.cursorX + 1,
        });
        if (this._ghostText) {
            this._disposables.add(this._ghostText);
        }
        this._ghostText?.onRender((e) => {
            e.classList.add('terminal-voice-progress-text');
            e.textContent = text;
            e.style.width = (xterm.cols - xterm.buffer.active.cursorX) / xterm.cols * 100 + '%';
        });
    }
};
TerminalVoiceSession = TerminalVoiceSession_1 = __decorate([
    __param(0, ISpeechService),
    __param(1, ITerminalService),
    __param(2, IConfigurationService),
    __param(3, IContextKeyService)
], TerminalVoiceSession);
export { TerminalVoiceSession };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxWb2ljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvdm9pY2UvYnJvd3Nlci90ZXJtaW5hbFZvaWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFMUcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDcEcsT0FBTyxFQUFFLGNBQWMsRUFBbUQsa0JBQWtCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUU5SSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDekUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFHckYsTUFBTSxTQUFTLEdBQThCO0lBQzVDLFdBQVcsRUFB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