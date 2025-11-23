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
import { CachedFunction } from '../../../base/common/cache.js';
import { getStructuralKey } from '../../../base/common/equals.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { FileAccess } from '../../../base/common/network.js';
import { derived, observableFromEvent, ValueWithChangeEventFromObservable } from '../../../base/common/observable.js';
import { localize } from '../../../nls.js';
import { IAccessibilityService } from '../../accessibility/common/accessibility.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { observableConfigValue } from '../../observable/common/platformObservableUtils.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
export const IAccessibilitySignalService = createDecorator('accessibilitySignalService');
/** Make sure you understand the doc comments of the method you want to call when using this token! */
export const AcknowledgeDocCommentsToken = Symbol('AcknowledgeDocCommentsToken');
let AccessibilitySignalService = class AccessibilitySignalService extends Disposable {
    constructor(configurationService, accessibilityService, telemetryService) {
        super();
        this.configurationService = configurationService;
        this.accessibilityService = accessibilityService;
        this.telemetryService = telemetryService;
        this.sounds = new Map();
        this.screenReaderAttached = observableFromEvent(this, this.accessibilityService.onDidChangeScreenReaderOptimized, () => /** @description accessibilityService.onDidChangeScreenReaderOptimized */ this.accessibilityService.isScreenReaderOptimized());
        this.sentTelemetry = new Set();
        this.playingSounds = new Set();
        this._signalConfigValue = new CachedFunction((signal) => observableConfigValue(signal.settingsKey, { sound: 'off', announcement: 'off' }, this.configurationService));
        this._signalEnabledState = new CachedFunction({ getCacheKey: getStructuralKey }, (arg) => {
            return derived(reader => {
                /** @description sound enabled */
                const setting = this._signalConfigValue.get(arg.signal).read(reader);
                if (arg.modality === 'sound' || arg.modality === undefined) {
                    if (arg.signal.managesOwnEnablement || checkEnabledState(setting.sound, () => this.screenReaderAttached.read(reader), arg.userGesture)) {
                        return true;
                    }
                }
                if (arg.modality === 'announcement' || arg.modality === undefined) {
                    if (checkEnabledState(setting.announcement, () => this.screenReaderAttached.read(reader), arg.userGesture)) {
                        return true;
                    }
                }
                return false;
            }).recomputeInitiallyAndOnChange(this._store);
        });
    }
    getEnabledState(signal, userGesture, modality) {
        return new ValueWithChangeEventFromObservable(this._signalEnabledState.get({ signal, userGesture, modality }));
    }
    async playSignal(signal, options = {}) {
        const shouldPlayAnnouncement = options.modality === 'announcement' || options.modality === undefined;
        const announcementMessage = options.customAlertMessage ?? signal.announcementMessage;
        if (shouldPlayAnnouncement && this.isAnnouncementEnabled(signal, options.userGesture) && announcementMessage) {
            this.accessibilityService.status(announcementMessage);
        }
        const shouldPlaySound = options.modality === 'sound' || options.modality === undefined;
        if (shouldPlaySound && this.isSoundEnabled(signal, options.userGesture)) {
            this.sendSignalTelemetry(signal, options.source);
            await this.playSound(signal.sound.getSound(), options.allowManyInParallel);
        }
    }
    async playSignals(signals) {
        for (const signal of signals) {
            this.sendSignalTelemetry('signal' in signal ? signal.signal : signal, 'source' in signal ? signal.source : undefined);
        }
        const signalArray = signals.map(s => 'signal' in s ? s.signal : s);
        const announcements = signalArray.filter(signal => this.isAnnouncementEnabled(signal)).map(s => s.announcementMessage);
        if (announcements.length) {
            this.accessibilityService.status(announcements.join(', '));
        }
        // Some sounds are reused. Don't play the same sound twice.
        const sounds = new Set(signalArray.filter(signal => this.isSoundEnabled(signal)).map(signal => signal.sound.getSound()));
        await Promise.all(Array.from(sounds).map(sound => this.playSound(sound, true)));
    }
    sendSignalTelemetry(signal, source) {
        const isScreenReaderOptimized = this.accessibilityService.isScreenReaderOptimized();
        const key = signal.name + (source ? `::${source}` : '') + (isScreenReaderOptimized ? '{screenReaderOptimized}' : '');
        // Only send once per user session
        if (this.sentTelemetry.has(key) || this.getVolumeInPercent() === 0) {
            return;
        }
        this.sentTelemetry.add(key);
        this.telemetryService.publicLog2('signal.played', {
            signal: signal.name,
            source: source ?? '',
            isScreenReaderOptimized,
        });
    }
    getVolumeInPercent() {
        const volume = this.configurationService.getValue('accessibility.signalOptions.volume');
        if (typeof volume !== 'number') {
            return 50;
        }
        return Math.max(Math.min(volume, 100), 0);
    }
    async playSound(sound, allowManyInParallel = false) {
        if (!allowManyInParallel && this.playingSounds.has(sound)) {
            return;
        }
        this.playingSounds.add(sound);
        const url = FileAccess.asBrowserUri(`vs/platform/accessibilitySignal/browser/media/${sound.fileName}`).toString(true);
        try {
            const sound = this.sounds.get(url);
            if (sound) {
                sound.volume = this.getVolumeInPercent() / 100;
                sound.currentTime = 0;
                await sound.play();
            }
            else {
                const playedSound = await playAudio(url, this.getVolumeInPercent() / 100);
                this.sounds.set(url, playedSound);
            }
        }
        catch (e) {
            if (!e.message.includes('play() can only be initiated by a user gesture')) {
                // tracking this issue in #178642, no need to spam the console
                console.error('Error while playing sound', e);
            }
        }
        finally {
            this.playingSounds.delete(sound);
        }
    }
    playSignalLoop(signal, milliseconds) {
        let playing = true;
        const playSound = () => {
            if (playing) {
                this.playSignal(signal, { allowManyInParallel: true }).finally(() => {
                    setTimeout(() => {
                        if (playing) {
                            playSound();
                        }
                    }, milliseconds);
                });
            }
        };
        playSound();
        return toDisposable(() => playing = false);
    }
    isAnnouncementEnabled(signal, userGesture) {
        if (!signal.announcementMessage) {
            return false;
        }
        return this._signalEnabledState.get({ signal, userGesture: !!userGesture, modality: 'announcement' }).get();
    }
    isSoundEnabled(signal, userGesture) {
        return this._signalEnabledState.get({ signal, userGesture: !!userGesture, modality: 'sound' }).get();
    }
    onSoundEnabledChanged(signal) {
        return this.getEnabledState(signal, false).onDidChange;
    }
    getDelayMs(signal, modality, mode) {
        if (!this.configurationService.getValue('accessibility.signalOptions.debouncePositionChanges')) {
            return 0;
        }
        let value;
        if (signal.name === AccessibilitySignal.errorAtPosition.name && mode === 'positional') {
            value = this.configurationService.getValue('accessibility.signalOptions.experimental.delays.errorAtPosition');
        }
        else if (signal.name === AccessibilitySignal.warningAtPosition.name && mode === 'positional') {
            value = this.configurationService.getValue('accessibility.signalOptions.experimental.delays.warningAtPosition');
        }
        else {
            value = this.configurationService.getValue('accessibility.signalOptions.experimental.delays.general');
        }
        return modality === 'sound' ? value.sound : value.announcement;
    }
};
AccessibilitySignalService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IAccessibilityService),
    __param(2, ITelemetryService)
], AccessibilitySignalService);
export { AccessibilitySignalService };
function checkEnabledState(state, getScreenReaderAttached, isTriggeredByUserGesture) {
    return state === 'on' || state === 'always' || (state === 'auto' && getScreenReaderAttached()) || state === 'userGesture' && isTriggeredByUserGesture;
}
/**
 * Play the given audio url.
 * @volume value between 0 and 1
 */
async function playAudio(url, volume) {
    const disposables = new DisposableStore();
    try {
        return await doPlayAudio(url, volume, disposables);
    }
    finally {
        disposables.dispose();
    }
}
function doPlayAudio(url, volume, disposables) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.volume = volume;
        disposables.add(addDisposableListener(audio, 'ended', () => {
            resolve(audio);
        }));
        disposables.add(addDisposableListener(audio, 'error', (e) => {
            // When the error event fires, ended might not be called
            reject(e.error);
        }));
        audio.play().catch(e => {
            // When play fails, the error event is not fired.
            reject(e);
        });
    });
}
/**
 * Corresponds to the audio files in ./media.
*/
export class Sound {
    static register(options) {
        const sound = new Sound(options.fileName);
        return sound;
    }
    static { this.error = Sound.register({ fileName: 'error.mp3' }); }
    static { this.warning = Sound.register({ fileName: 'warning.mp3' }); }
    static { this.success = Sound.register({ fileName: 'success.mp3' }); }
    static { this.foldedArea = Sound.register({ fileName: 'foldedAreas.mp3' }); }
    static { this.break = Sound.register({ fileName: 'break.mp3' }); }
    static { this.quickFixes = Sound.register({ fileName: 'quickFixes.mp3' }); }
    static { this.taskCompleted = Sound.register({ fileName: 'taskCompleted.mp3' }); }
    static { this.taskFailed = Sound.register({ fileName: 'taskFailed.mp3' }); }
    static { this.terminalBell = Sound.register({ fileName: 'terminalBell.mp3' }); }
    static { this.diffLineInserted = Sound.register({ fileName: 'diffLineInserted.mp3' }); }
    static { this.diffLineDeleted = Sound.register({ fileName: 'diffLineDeleted.mp3' }); }
    static { this.diffLineModified = Sound.register({ fileName: 'diffLineModified.mp3' }); }
    static { this.requestSent = Sound.register({ fileName: 'requestSent.mp3' }); }
    static { this.responseReceived1 = Sound.register({ fileName: 'responseReceived1.mp3' }); }
    static { this.responseReceived2 = Sound.register({ fileName: 'responseReceived2.mp3' }); }
    static { this.responseReceived3 = Sound.register({ fileName: 'responseReceived3.mp3' }); }
    static { this.responseReceived4 = Sound.register({ fileName: 'responseReceived4.mp3' }); }
    static { this.clear = Sound.register({ fileName: 'clear.mp3' }); }
    static { this.save = Sound.register({ fileName: 'save.mp3' }); }
    static { this.format = Sound.register({ fileName: 'format.mp3' }); }
    static { this.voiceRecordingStarted = Sound.register({ fileName: 'voiceRecordingStarted.mp3' }); }
    static { this.voiceRecordingStopped = Sound.register({ fileName: 'voiceRecordingStopped.mp3' }); }
    static { this.progress = Sound.register({ fileName: 'progress.mp3' }); }
    static { this.chatEditModifiedFile = Sound.register({ fileName: 'chatEditModifiedFile.mp3' }); }
    static { this.editsKept = Sound.register({ fileName: 'editsKept.mp3' }); }
    static { this.editsUndone = Sound.register({ fileName: 'editsUndone.mp3' }); }
    static { this.nextEditSuggestion = Sound.register({ fileName: 'nextEditSuggestion.mp3' }); }
    static { this.terminalCommandSucceeded = Sound.register({ fileName: 'terminalCommandSucceeded.mp3' }); }
    static { this.chatUserActionRequired = Sound.register({ fileName: 'chatUserActionRequired.mp3' }); }
    static { this.codeActionTriggered = Sound.register({ fileName: 'codeActionTriggered.mp3' }); }
    static { this.codeActionApplied = Sound.register({ fileName: 'codeActionApplied.mp3' }); }
    constructor(fileName) {
        this.fileName = fileName;
    }
}
export class SoundSource {
    constructor(randomOneOf) {
        this.randomOneOf = randomOneOf;
    }
    getSound(deterministic = false) {
        if (deterministic || this.randomOneOf.length === 1) {
            return this.randomOneOf[0];
        }
        else {
            const index = Math.floor(Math.random() * this.randomOneOf.length);
            return this.randomOneOf[index];
        }
    }
}
export class AccessibilitySignal {
    constructor(sound, name, legacySoundSettingsKey, settingsKey, legacyAnnouncementSettingsKey, announcementMessage, managesOwnEnablement = false) {
        this.sound = sound;
        this.name = name;
        this.legacySoundSettingsKey = legacySoundSettingsKey;
        this.settingsKey = settingsKey;
        this.legacyAnnouncementSettingsKey = legacyAnnouncementSettingsKey;
        this.announcementMessage = announcementMessage;
        this.managesOwnEnablement = managesOwnEnablement;
    }
    static { this._signals = new Set(); }
    static register(options) {
        const soundSource = new SoundSource('randomOneOf' in options.sound ? options.sound.randomOneOf : [options.sound]);
        const signal = new AccessibilitySignal(soundSource, options.name, options.legacySoundSettingsKey, options.settingsKey, options.legacyAnnouncementSettingsKey, options.announcementMessage, options.managesOwnEnablement);
        AccessibilitySignal._signals.add(signal);
        return signal;
    }
    static get allAccessibilitySignals() {
        return [...this._signals];
    }
    static { this.errorAtPosition = AccessibilitySignal.register({
        name: localize('accessibilitySignals.positionHasError.name', 'Error at Position'),
        sound: Sound.error,
        announcementMessage: localize('accessibility.signals.positionHasError', 'Error'),
        settingsKey: 'accessibility.signals.positionHasError',
        delaySettingsKey: 'accessibility.signalOptions.delays.errorAtPosition'
    }); }
    static { this.warningAtPosition = AccessibilitySignal.register({
        name: localize('accessibilitySignals.positionHasWarning.name', 'Warning at Position'),
        sound: Sound.warning,
        announcementMessage: localize('accessibility.signals.positionHasWarning', 'Warning'),
        settingsKey: 'accessibility.signals.positionHasWarning',
        delaySettingsKey: 'accessibility.signalOptions.delays.warningAtPosition'
    }); }
    static { this.errorOnLine = AccessibilitySignal.register({
        name: localize('accessibilitySignals.lineHasError.name', 'Error on Line'),
        sound: Sound.error,
        legacySoundSettingsKey: 'audioCues.lineHasError',
        legacyAnnouncementSettingsKey: 'accessibility.alert.error',
        announcementMessage: localize('accessibility.signals.lineHasError', 'Error on Line'),
        settingsKey: 'accessibility.signals.lineHasError',
    }); }
    static { this.warningOnLine = AccessibilitySignal.register({
        name: localize('accessibilitySignals.lineHasWarning.name', 'Warning on Line'),
        sound: Sound.warning,
        legacySoundSettingsKey: 'audioCues.lineHasWarning',
        legacyAnnouncementSettingsKey: 'accessibility.alert.warning',
        announcementMessage: localize('accessibility.signals.lineHasWarning', 'Warning on Line'),
        settingsKey: 'accessibility.signals.lineHasWarning',
    }); }
    static { this.foldedArea = AccessibilitySignal.register({
        name: localize('accessibilitySignals.lineHasFoldedArea.name', 'Folded Area on Line'),
        sound: Sound.foldedArea,
        legacySoundSettingsKey: 'audioCues.lineHasFoldedArea',
        legacyAnnouncementSettingsKey: 'accessibility.alert.foldedArea',
        announcementMessage: localize('accessibility.signals.lineHasFoldedArea', 'Folded'),
        settingsKey: 'accessibility.signals.lineHasFoldedArea',
    }); }
    static { this.break = AccessibilitySignal.register({
        name: localize('accessibilitySignals.lineHasBreakpoint.name', 'Breakpoint on Line'),
        sound: Sound.break,
        legacySoundSettingsKey: 'audioCues.lineHasBreakpoint',
        legacyAnnouncementSettingsKey: 'accessibility.alert.breakpoint',
        announcementMessage: localize('accessibility.signals.lineHasBreakpoint', 'Breakpoint'),
        settingsKey: 'accessibility.signals.lineHasBreakpoint',
    }); }
    static { this.inlineSuggestion = AccessibilitySignal.register({
        name: localize('accessibilitySignals.lineHasInlineSuggestion.name', 'Inline Suggestion on Line'),
        sound: Sound.quickFixes,
        legacySoundSettingsKey: 'audioCues.lineHasInlineSuggestion',
        settingsKey: 'accessibility.signals.lineHasInlineSuggestion',
    }); }
    static { this.nextEditSuggestion = AccessibilitySignal.register({
        name: localize('accessibilitySignals.nextEditSuggestion.name', 'Next Edit Suggestion on Line'),
        sound: Sound.nextEditSuggestion,
        legacySoundSettingsKey: 'audioCues.nextEditSuggestion',
        settingsKey: 'accessibility.signals.nextEditSuggestion',
        announcementMessage: localize('accessibility.signals.nextEditSuggestion', 'Next Edit Suggestion'),
    }); }
    static { this.terminalQuickFix = AccessibilitySignal.register({
        name: localize('accessibilitySignals.terminalQuickFix.name', 'Terminal Quick Fix'),
        sound: Sound.quickFixes,
        legacySoundSettingsKey: 'audioCues.terminalQuickFix',
        legacyAnnouncementSettingsKey: 'accessibility.alert.terminalQuickFix',
        announcementMessage: localize('accessibility.signals.terminalQuickFix', 'Quick Fix'),
        settingsKey: 'accessibility.signals.terminalQuickFix',
    }); }
    static { this.onDebugBreak = AccessibilitySignal.register({
        name: localize('accessibilitySignals.onDebugBreak.name', 'Debugger Stopped on Breakpoint'),
        sound: Sound.break,
        legacySoundSettingsKey: 'audioCues.onDebugBreak',
        legacyAnnouncementSettingsKey: 'accessibility.alert.onDebugBreak',
        announcementMessage: localize('accessibility.signals.onDebugBreak', 'Breakpoint'),
        settingsKey: 'accessibility.signals.onDebugBreak',
    }); }
    static { this.noInlayHints = AccessibilitySignal.register({
        name: localize('accessibilitySignals.noInlayHints', 'No Inlay Hints on Line'),
        sound: Sound.error,
        legacySoundSettingsKey: 'audioCues.noInlayHints',
        legacyAnnouncementSettingsKey: 'accessibility.alert.noInlayHints',
        announcementMessage: localize('accessibility.signals.noInlayHints', 'No Inlay Hints'),
        settingsKey: 'accessibility.signals.noInlayHints',
    }); }
    static { this.taskCompleted = AccessibilitySignal.register({
        name: localize('accessibilitySignals.taskCompleted', 'Task Completed'),
        sound: Sound.taskCompleted,
        legacySoundSettingsKey: 'audioCues.taskCompleted',
        legacyAnnouncementSettingsKey: 'accessibility.alert.taskCompleted',
        announcementMessage: localize('accessibility.signals.taskCompleted', 'Task Completed'),
        settingsKey: 'accessibility.signals.taskCompleted',
    }); }
    static { this.taskFailed = AccessibilitySignal.register({
        name: localize('accessibilitySignals.taskFailed', 'Task Failed'),
        sound: Sound.taskFailed,
        legacySoundSettingsKey: 'audioCues.taskFailed',
        legacyAnnouncementSettingsKey: 'accessibility.alert.taskFailed',
        announcementMessage: localize('accessibility.signals.taskFailed', 'Task Failed'),
        settingsKey: 'accessibility.signals.taskFailed',
    }); }
    static { this.terminalCommandFailed = AccessibilitySignal.register({
        name: localize('accessibilitySignals.terminalCommandFailed', 'Terminal Command Failed'),
        sound: Sound.error,
        legacySoundSettingsKey: 'audioCues.terminalCommandFailed',
        legacyAnnouncementSettingsKey: 'accessibility.alert.terminalCommandFailed',
        announcementMessage: localize('accessibility.signals.terminalCommandFailed', 'Command Failed'),
        settingsKey: 'accessibility.signals.terminalCommandFailed',
    }); }
    static { this.terminalCommandSucceeded = AccessibilitySignal.register({
        name: localize('accessibilitySignals.terminalCommandSucceeded', 'Terminal Command Succeeded'),
        sound: Sound.terminalCommandSucceeded,
        announcementMessage: localize('accessibility.signals.terminalCommandSucceeded', 'Command Succeeded'),
        settingsKey: 'accessibility.signals.terminalCommandSucceeded',
    }); }
    static { this.terminalBell = AccessibilitySignal.register({
        name: localize('accessibilitySignals.terminalBell', 'Terminal Bell'),
        sound: Sound.terminalBell,
        legacySoundSettingsKey: 'audioCues.terminalBell',
        legacyAnnouncementSettingsKey: 'accessibility.alert.terminalBell',
        announcementMessage: localize('accessibility.signals.terminalBell', 'Terminal Bell'),
        settingsKey: 'accessibility.signals.terminalBell',
    }); }
    static { this.notebookCellCompleted = AccessibilitySignal.register({
        name: localize('accessibilitySignals.notebookCellCompleted', 'Notebook Cell Completed'),
        sound: Sound.taskCompleted,
        legacySoundSettingsKey: 'audioCues.notebookCellCompleted',
        legacyAnnouncementSettingsKey: 'accessibility.alert.notebookCellCompleted',
        announcementMessage: localize('accessibility.signals.notebookCellCompleted', 'Notebook Cell Completed'),
        settingsKey: 'accessibility.signals.notebookCellCompleted',
    }); }
    static { this.notebookCellFailed = AccessibilitySignal.register({
        name: localize('accessibilitySignals.notebookCellFailed', 'Notebook Cell Failed'),
        sound: Sound.taskFailed,
        legacySoundSettingsKey: 'audioCues.notebookCellFailed',
        legacyAnnouncementSettingsKey: 'accessibility.alert.notebookCellFailed',
        announcementMessage: localize('accessibility.signals.notebookCellFailed', 'Notebook Cell Failed'),
        settingsKey: 'accessibility.signals.notebookCellFailed',
    }); }
    static { this.diffLineInserted = AccessibilitySignal.register({
        name: localize('accessibilitySignals.diffLineInserted', 'Diff Line Inserted'),
        sound: Sound.diffLineInserted,
        legacySoundSettingsKey: 'audioCues.diffLineInserted',
        settingsKey: 'accessibility.signals.diffLineInserted',
    }); }
    static { this.diffLineDeleted = AccessibilitySignal.register({
        name: localize('accessibilitySignals.diffLineDeleted', 'Diff Line Deleted'),
        sound: Sound.diffLineDeleted,
        legacySoundSettingsKey: 'audioCues.diffLineDeleted',
        settingsKey: 'accessibility.signals.diffLineDeleted',
    }); }
    static { this.diffLineModified = AccessibilitySignal.register({
        name: localize('accessibilitySignals.diffLineModified', 'Diff Line Modified'),
        sound: Sound.diffLineModified,
        legacySoundSettingsKey: 'audioCues.diffLineModified',
        settingsKey: 'accessibility.signals.diffLineModified',
    }); }
    static { this.chatEditModifiedFile = AccessibilitySignal.register({
        name: localize('accessibilitySignals.chatEditModifiedFile', 'Chat Edit Modified File'),
        sound: Sound.chatEditModifiedFile,
        announcementMessage: localize('accessibility.signals.chatEditModifiedFile', 'File Modified from Chat Edits'),
        settingsKey: 'accessibility.signals.chatEditModifiedFile',
    }); }
    static { this.chatRequestSent = AccessibilitySignal.register({
        name: localize('accessibilitySignals.chatRequestSent', 'Chat Request Sent'),
        sound: Sound.requestSent,
        legacySoundSettingsKey: 'audioCues.chatRequestSent',
        legacyAnnouncementSettingsKey: 'accessibility.alert.chatRequestSent',
        announcementMessage: localize('accessibility.signals.chatRequestSent', 'Chat Request Sent'),
        settingsKey: 'accessibility.signals.chatRequestSent',
    }); }
    static { this.chatResponseReceived = AccessibilitySignal.register({
        name: localize('accessibilitySignals.chatResponseReceived', 'Chat Response Received'),
        legacySoundSettingsKey: 'audioCues.chatResponseReceived',
        sound: {
            randomOneOf: [
                Sound.responseReceived1,
                Sound.responseReceived2,
                Sound.responseReceived3,
                Sound.responseReceived4
            ]
        },
        settingsKey: 'accessibility.signals.chatResponseReceived'
    }); }
    static { this.codeActionTriggered = AccessibilitySignal.register({
        name: localize('accessibilitySignals.codeActionRequestTriggered', 'Code Action Request Triggered'),
        sound: Sound.codeActionTriggered,
        legacySoundSettingsKey: 'audioCues.codeActionRequestTriggered',
        legacyAnnouncementSettingsKey: 'accessibility.alert.codeActionRequestTriggered',
        announcementMessage: localize('accessibility.signals.codeActionRequestTriggered', 'Code Action Request Triggered'),
        settingsKey: 'accessibility.signals.codeActionTriggered',
    }); }
    static { this.codeActionApplied = AccessibilitySignal.register({
        name: localize('accessibilitySignals.codeActionApplied', 'Code Action Applied'),
        legacySoundSettingsKey: 'audioCues.codeActionApplied',
        sound: Sound.codeActionApplied,
        settingsKey: 'accessibility.signals.codeActionApplied'
    }); }
    static { this.progress = AccessibilitySignal.register({
        name: localize('accessibilitySignals.progress', 'Progress'),
        sound: Sound.progress,
        legacySoundSettingsKey: 'audioCues.chatResponsePending',
        legacyAnnouncementSettingsKey: 'accessibility.alert.progress',
        announcementMessage: localize('accessibility.signals.progress', 'Progress'),
        settingsKey: 'accessibility.signals.progress'
    }); }
    static { this.clear = AccessibilitySignal.register({
        name: localize('accessibilitySignals.clear', 'Clear'),
        sound: Sound.clear,
        legacySoundSettingsKey: 'audioCues.clear',
        legacyAnnouncementSettingsKey: 'accessibility.alert.clear',
        announcementMessage: localize('accessibility.signals.clear', 'Clear'),
        settingsKey: 'accessibility.signals.clear'
    }); }
    static { this.save = AccessibilitySignal.register({
        name: localize('accessibilitySignals.save', 'Save'),
        sound: Sound.save,
        legacySoundSettingsKey: 'audioCues.save',
        legacyAnnouncementSettingsKey: 'accessibility.alert.save',
        announcementMessage: localize('accessibility.signals.save', 'Save'),
        settingsKey: 'accessibility.signals.save'
    }); }
    static { this.format = AccessibilitySignal.register({
        name: localize('accessibilitySignals.format', 'Format'),
        sound: Sound.format,
        legacySoundSettingsKey: 'audioCues.format',
        legacyAnnouncementSettingsKey: 'accessibility.alert.format',
        announcementMessage: localize('accessibility.signals.format', 'Format'),
        settingsKey: 'accessibility.signals.format'
    }); }
    static { this.voiceRecordingStarted = AccessibilitySignal.register({
        name: localize('accessibilitySignals.voiceRecordingStarted', 'Voice Recording Started'),
        sound: Sound.voiceRecordingStarted,
        legacySoundSettingsKey: 'audioCues.voiceRecordingStarted',
        settingsKey: 'accessibility.signals.voiceRecordingStarted'
    }); }
    static { this.voiceRecordingStopped = AccessibilitySignal.register({
        name: localize('accessibilitySignals.voiceRecordingStopped', 'Voice Recording Stopped'),
        sound: Sound.voiceRecordingStopped,
        legacySoundSettingsKey: 'audioCues.voiceRecordingStopped',
        settingsKey: 'accessibility.signals.voiceRecordingStopped'
    }); }
    static { this.editsKept = AccessibilitySignal.register({
        name: localize('accessibilitySignals.editsKept', 'Edits Kept'),
        sound: Sound.editsKept,
        announcementMessage: localize('accessibility.signals.editsKept', 'Edits Kept'),
        settingsKey: 'accessibility.signals.editsKept',
    }); }
    static { this.editsUndone = AccessibilitySignal.register({
        name: localize('accessibilitySignals.editsUndone', 'Undo Edits'),
        sound: Sound.editsUndone,
        announcementMessage: localize('accessibility.signals.editsUndone', 'Edits Undone'),
        settingsKey: 'accessibility.signals.editsUndone',
    }); }
    static { this.chatUserActionRequired = AccessibilitySignal.register({
        name: localize('accessibilitySignals.chatUserActionRequired', 'Chat User Action Required'),
        sound: Sound.chatUserActionRequired,
        announcementMessage: localize('accessibility.signals.chatUserActionRequired', 'Chat User Action Required'),
        settingsKey: 'accessibility.signals.chatUserActionRequired',
        managesOwnEnablement: true
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3RILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDOUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDM0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFeEUsTUFBTSxDQUFDLE1BQU0sMkJBQTJCLEdBQUcsZUFBZSxDQUE4Qiw0QkFBNEIsQ0FBQyxDQUFDO0FBd0J0SCxzR0FBc0c7QUFDdEcsTUFBTSxDQUFDLE1BQU0sMkJB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