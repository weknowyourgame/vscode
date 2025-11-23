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
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { createCommandUri, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import { InvisibleCharacters, isBasicASCII } from '../../../../base/common/strings.js';
import './unicodeHighlighter.css';
import { EditorAction, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { inUntrustedWorkspace, unicodeHighlightConfigKeys } from '../../../common/config/editorOptions.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { UnicodeTextModelHighlighter } from '../../../common/services/unicodeTextModelHighlighter.js';
import { IEditorWorkerService } from '../../../common/services/editorWorker.js';
import { HoverParticipantRegistry } from '../../hover/browser/hoverTypes.js';
import { MarkdownHover, renderMarkdownHovers } from '../../hover/browser/markdownHoverParticipant.js';
import { BannerController } from './bannerController.js';
import * as nls from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { safeIntl } from '../../../../base/common/date.js';
import { isModelDecorationInComment, isModelDecorationInString, isModelDecorationVisible } from '../../../common/viewModel/viewModelDecoration.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
export const warningIcon = registerIcon('extensions-warning-message', Codicon.warning, nls.localize('warningIcon', 'Icon shown with a warning message in the extensions editor.'));
let UnicodeHighlighter = class UnicodeHighlighter extends Disposable {
    static { this.ID = 'editor.contrib.unicodeHighlighter'; }
    constructor(_editor, _editorWorkerService, _workspaceTrustService, instantiationService) {
        super();
        this._editor = _editor;
        this._editorWorkerService = _editorWorkerService;
        this._workspaceTrustService = _workspaceTrustService;
        this._highlighter = null;
        this._bannerClosed = false;
        this._updateState = (state) => {
            if (state && state.hasMore) {
                if (this._bannerClosed) {
                    return;
                }
                // This document contains many non-basic ASCII characters.
                const max = Math.max(state.ambiguousCharacterCount, state.nonBasicAsciiCharacterCount, state.invisibleCharacterCount);
                let data;
                if (state.nonBasicAsciiCharacterCount >= max) {
                    data = {
                        message: nls.localize('unicodeHighlighting.thisDocumentHasManyNonBasicAsciiUnicodeCharacters', 'This document contains many non-basic ASCII unicode characters'),
                        command: new DisableHighlightingOfNonBasicAsciiCharactersAction(),
                    };
                }
                else if (state.ambiguousCharacterCount >= max) {
                    data = {
                        message: nls.localize('unicodeHighlighting.thisDocumentHasManyAmbiguousUnicodeCharacters', 'This document contains many ambiguous unicode characters'),
                        command: new DisableHighlightingOfAmbiguousCharactersAction(),
                    };
                }
                else if (state.invisibleCharacterCount >= max) {
                    data = {
                        message: nls.localize('unicodeHighlighting.thisDocumentHasManyInvisibleUnicodeCharacters', 'This document contains many invisible unicode characters'),
                        command: new DisableHighlightingOfInvisibleCharactersAction(),
                    };
                }
                else {
                    throw new Error('Unreachable');
                }
                this._bannerController.show({
                    id: 'unicodeHighlightBanner',
                    message: data.message,
                    icon: warningIcon,
                    actions: [
                        {
                            label: data.command.shortLabel,
                            href: `command:${data.command.desc.id}`
                        }
                    ],
                    onClose: () => {
                        this._bannerClosed = true;
                    },
                });
            }
            else {
                this._bannerController.hide();
            }
        };
        this._bannerController = this._register(instantiationService.createInstance(BannerController, _editor));
        this._register(this._editor.onDidChangeModel(() => {
            this._bannerClosed = false;
            this._updateHighlighter();
        }));
        this._options = _editor.getOption(142 /* EditorOption.unicodeHighlighting */);
        this._register(_workspaceTrustService.onDidChangeTrust(e => {
            this._updateHighlighter();
        }));
        this._register(_editor.onDidChangeConfiguration(e => {
            if (e.hasChanged(142 /* EditorOption.unicodeHighlighting */)) {
                this._options = _editor.getOption(142 /* EditorOption.unicodeHighlighting */);
                this._updateHighlighter();
            }
        }));
        this._updateHighlighter();
    }
    dispose() {
        if (this._highlighter) {
            this._highlighter.dispose();
            this._highlighter = null;
        }
        super.dispose();
    }
    _updateHighlighter() {
        this._updateState(null);
        if (this._highlighter) {
            this._highlighter.dispose();
            this._highlighter = null;
        }
        if (!this._editor.hasModel()) {
            return;
        }
        const options = resolveOptions(this._workspaceTrustService.isWorkspaceTrusted(), this._options);
        if ([
            options.nonBasicASCII,
            options.ambiguousCharacters,
            options.invisibleCharacters,
        ].every((option) => option === false)) {
            // Don't do anything if the feature is fully disabled
            return;
        }
        const highlightOptions = {
            nonBasicASCII: options.nonBasicASCII,
            ambiguousCharacters: options.ambiguousCharacters,
            invisibleCharacters: options.invisibleCharacters,
            includeComments: options.includeComments,
            includeStrings: options.includeStrings,
            allowedCodePoints: Object.keys(options.allowedCharacters).map(c => c.codePointAt(0)),
            allowedLocales: Object.keys(options.allowedLocales).map(locale => {
                if (locale === '_os') {
                    const osLocale = safeIntl.NumberFormat().value.resolvedOptions().locale;
                    return osLocale;
                }
                else if (locale === '_vscode') {
                    return platform.language;
                }
                return locale;
            }),
        };
        if (this._editorWorkerService.canComputeUnicodeHighlights(this._editor.getModel().uri)) {
            this._highlighter = new DocumentUnicodeHighlighter(this._editor, highlightOptions, this._updateState, this._editorWorkerService);
        }
        else {
            this._highlighter = new ViewportUnicodeHighlighter(this._editor, highlightOptions, this._updateState);
        }
    }
    getDecorationInfo(decoration) {
        if (this._highlighter) {
            return this._highlighter.getDecorationInfo(decoration);
        }
        return null;
    }
};
UnicodeHighlighter = __decorate([
    __param(1, IEditorWorkerService),
    __param(2, IWorkspaceTrustManagementService),
    __param(3, IInstantiationService)
], UnicodeHighlighter);
export { UnicodeHighlighter };
function resolveOptions(trusted, options) {
    return {
        nonBasicASCII: options.nonBasicASCII === inUntrustedWorkspace ? !trusted : options.nonBasicASCII,
        ambiguousCharacters: options.ambiguousCharacters,
        invisibleCharacters: options.invisibleCharacters,
        includeComments: options.includeComments === inUntrustedWorkspace ? !trusted : options.includeComments,
        includeStrings: options.includeStrings === inUntrustedWorkspace ? !trusted : options.includeStrings,
        allowedCharacters: options.allowedCharacters,
        allowedLocales: options.allowedLocales,
    };
}
let DocumentUnicodeHighlighter = class DocumentUnicodeHighlighter extends Disposable {
    constructor(_editor, _options, _updateState, _editorWorkerService) {
        super();
        this._editor = _editor;
        this._options = _options;
        this._updateState = _updateState;
        this._editorWorkerService = _editorWorkerService;
        this._model = this._editor.getModel();
        this._decorations = this._editor.createDecorationsCollection();
        this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
        this._register(this._editor.onDidChangeModelContent(() => {
            this._updateSoon.schedule();
        }));
        this._updateSoon.schedule();
    }
    dispose() {
        this._decorations.clear();
        super.dispose();
    }
    _update() {
        if (this._model.isDisposed()) {
            return;
        }
        if (!this._model.mightContainNonBasicASCII()) {
            this._decorations.clear();
            return;
        }
        const modelVersionId = this._model.getVersionId();
        this._editorWorkerService
            .computedUnicodeHighlights(this._model.uri, this._options)
            .then((info) => {
            if (this._model.isDisposed()) {
                return;
            }
            if (this._model.getVersionId() !== modelVersionId) {
                // model changed in the meantime
                return;
            }
            this._updateState(info);
            const decorations = [];
            if (!info.hasMore) {
                // Don't show decoration if there are too many.
                // In this case, a banner is shown.
                for (const range of info.ranges) {
                    decorations.push({
                        range: range,
                        options: Decorations.instance.getDecorationFromOptions(this._options),
                    });
                }
            }
            this._decorations.set(decorations);
        });
    }
    getDecorationInfo(decoration) {
        if (!this._decorations.has(decoration)) {
            return null;
        }
        const model = this._editor.getModel();
        if (!isModelDecorationVisible(model, decoration)) {
            return null;
        }
        const text = model.getValueInRange(decoration.range);
        return {
            reason: computeReason(text, this._options),
            inComment: isModelDecorationInComment(model, decoration),
            inString: isModelDecorationInString(model, decoration),
        };
    }
};
DocumentUnicodeHighlighter = __decorate([
    __param(3, IEditorWorkerService)
], DocumentUnicodeHighlighter);
class ViewportUnicodeHighlighter extends Disposable {
    constructor(_editor, _options, _updateState) {
        super();
        this._editor = _editor;
        this._options = _options;
        this._updateState = _updateState;
        this._model = this._editor.getModel();
        this._decorations = this._editor.createDecorationsCollection();
        this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
        this._register(this._editor.onDidLayoutChange(() => {
            this._updateSoon.schedule();
        }));
        this._register(this._editor.onDidScrollChange(() => {
            this._updateSoon.schedule();
        }));
        this._register(this._editor.onDidChangeHiddenAreas(() => {
            this._updateSoon.schedule();
        }));
        this._register(this._editor.onDidChangeModelContent(() => {
            this._updateSoon.schedule();
        }));
        this._updateSoon.schedule();
    }
    dispose() {
        this._decorations.clear();
        super.dispose();
    }
    _update() {
        if (this._model.isDisposed()) {
            return;
        }
        if (!this._model.mightContainNonBasicASCII()) {
            this._decorations.clear();
            return;
        }
        const ranges = this._editor.getVisibleRanges();
        const decorations = [];
        const totalResult = {
            ranges: [],
            ambiguousCharacterCount: 0,
            invisibleCharacterCount: 0,
            nonBasicAsciiCharacterCount: 0,
            hasMore: false,
        };
        for (const range of ranges) {
            const result = UnicodeTextModelHighlighter.computeUnicodeHighlights(this._model, this._options, range);
            for (const r of result.ranges) {
                totalResult.ranges.push(r);
            }
            totalResult.ambiguousCharacterCount += totalResult.ambiguousCharacterCount;
            totalResult.invisibleCharacterCount += totalResult.invisibleCharacterCount;
            totalResult.nonBasicAsciiCharacterCount += totalResult.nonBasicAsciiCharacterCount;
            totalResult.hasMore = totalResult.hasMore || result.hasMore;
        }
        if (!totalResult.hasMore) {
            // Don't show decorations if there are too many.
            // A banner will be shown instead.
            for (const range of totalResult.ranges) {
                decorations.push({ range, options: Decorations.instance.getDecorationFromOptions(this._options) });
            }
        }
        this._updateState(totalResult);
        this._decorations.set(decorations);
    }
    getDecorationInfo(decoration) {
        if (!this._decorations.has(decoration)) {
            return null;
        }
        const model = this._editor.getModel();
        const text = model.getValueInRange(decoration.range);
        if (!isModelDecorationVisible(model, decoration)) {
            return null;
        }
        return {
            reason: computeReason(text, this._options),
            inComment: isModelDecorationInComment(model, decoration),
            inString: isModelDecorationInString(model, decoration),
        };
    }
}
export class UnicodeHighlighterHover {
    constructor(owner, range, decoration) {
        this.owner = owner;
        this.range = range;
        this.decoration = decoration;
    }
    isValidForHoverAnchor(anchor) {
        return (anchor.type === 1 /* HoverAnchorType.Range */
            && this.range.startColumn <= anchor.range.startColumn
            && this.range.endColumn >= anchor.range.endColumn);
    }
}
const configureUnicodeHighlightOptionsStr = nls.localize('unicodeHighlight.configureUnicodeHighlightOptions', 'Configure Unicode Highlight Options');
let UnicodeHighlighterHoverParticipant = class UnicodeHighlighterHoverParticipant {
    constructor(_editor, _markdownRendererService) {
        this._editor = _editor;
        this._markdownRendererService = _markdownRendererService;
        this.hoverOrdinal = 5;
    }
    computeSync(anchor, lineDecorations) {
        if (!this._editor.hasModel() || anchor.type !== 1 /* HoverAnchorType.Range */) {
            return [];
        }
        const model = this._editor.getModel();
        const unicodeHighlighter = this._editor.getContribution(UnicodeHighlighter.ID);
        if (!unicodeHighlighter) {
            return [];
        }
        const result = [];
        const existedReason = new Set();
        let index = 300;
        for (const d of lineDecorations) {
            const highlightInfo = unicodeHighlighter.getDecorationInfo(d);
            if (!highlightInfo) {
                continue;
            }
            const char = model.getValueInRange(d.range);
            // text refers to a single character.
            const codePoint = char.codePointAt(0);
            const codePointStr = formatCodePointMarkdown(codePoint);
            let reason;
            switch (highlightInfo.reason.kind) {
                case 0 /* UnicodeHighlighterReasonKind.Ambiguous */: {
                    if (isBasicASCII(highlightInfo.reason.confusableWith)) {
                        reason = nls.localize('unicodeHighlight.characterIsAmbiguousASCII', 'The character {0} could be confused with the ASCII character {1}, which is more common in source code.', codePointStr, formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0)));
                    }
                    else {
                        reason = nls.localize('unicodeHighlight.characterIsAmbiguous', 'The character {0} could be confused with the character {1}, which is more common in source code.', codePointStr, formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0)));
                    }
                    break;
                }
                case 1 /* UnicodeHighlighterReasonKind.Invisible */:
                    reason = nls.localize('unicodeHighlight.characterIsInvisible', 'The character {0} is invisible.', codePointStr);
                    break;
                case 2 /* UnicodeHighlighterReasonKind.NonBasicAscii */:
                    reason = nls.localize('unicodeHighlight.characterIsNonBasicAscii', 'The character {0} is not a basic ASCII character.', codePointStr);
                    break;
            }
            if (existedReason.has(reason)) {
                continue;
            }
            existedReason.add(reason);
            const adjustSettingsArgs = {
                codePoint: codePoint,
                reason: highlightInfo.reason,
                inComment: highlightInfo.inComment,
                inString: highlightInfo.inString,
            };
            const adjustSettings = nls.localize('unicodeHighlight.adjustSettings', 'Adjust settings');
            const uri = createCommandUri(ShowExcludeOptions.ID, adjustSettingsArgs);
            const markdown = new MarkdownString('', true)
                .appendMarkdown(reason)
                .appendText(' ')
                .appendLink(uri, adjustSettings, configureUnicodeHighlightOptionsStr);
            result.push(new MarkdownHover(this, d.range, [markdown], false, index++));
        }
        return result;
    }
    renderHoverParts(context, hoverParts) {
        return renderMarkdownHovers(context, hoverParts, this._editor, this._markdownRendererService);
    }
    getAccessibleContent(hoverPart) {
        return hoverPart.contents.map(c => c.value).join('\n');
    }
};
UnicodeHighlighterHoverParticipant = __decorate([
    __param(1, IMarkdownRendererService)
], UnicodeHighlighterHoverParticipant);
export { UnicodeHighlighterHoverParticipant };
function codePointToHex(codePoint) {
    return `U+${codePoint.toString(16).padStart(4, '0')}`;
}
function formatCodePointMarkdown(codePoint) {
    let value = `\`${codePointToHex(codePoint)}\``;
    if (!InvisibleCharacters.isInvisibleCharacter(codePoint)) {
        // Don't render any control characters or any invisible characters, as they cannot be seen anyways.
        value += ` "${`${renderCodePointAsInlineCode(codePoint)}`}"`;
    }
    return value;
}
function renderCodePointAsInlineCode(codePoint) {
    if (codePoint === 96 /* CharCode.BackTick */) {
        return '`` ` ``';
    }
    return '`' + String.fromCodePoint(codePoint) + '`';
}
function computeReason(char, options) {
    return UnicodeTextModelHighlighter.computeUnicodeHighlightReason(char, options);
}
class Decorations {
    constructor() {
        this.map = new Map();
    }
    static { this.instance = new Decorations(); }
    getDecorationFromOptions(options) {
        return this.getDecoration(!options.includeComments, !options.includeStrings);
    }
    getDecoration(hideInComments, hideInStrings) {
        const key = `${hideInComments}${hideInStrings}`;
        let options = this.map.get(key);
        if (!options) {
            options = ModelDecorationOptions.createDynamic({
                description: 'unicode-highlight',
                stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */,
                className: 'unicode-highlight',
                showIfCollapsed: true,
                overviewRuler: null,
                minimap: null,
                hideInCommentTokens: hideInComments,
                hideInStringTokens: hideInStrings,
            });
            this.map.set(key, options);
        }
        return options;
    }
}
export class DisableHighlightingInCommentsAction extends EditorAction {
    static { this.ID = 'editor.action.unicodeHighlight.disableHighlightingInComments'; }
    constructor() {
        super({
            id: DisableHighlightingOfAmbiguousCharactersAction.ID,
            label: nls.localize2('action.unicodeHighlight.disableHighlightingInComments', "Disable highlighting of characters in comments"),
            precondition: undefined
        });
        this.shortLabel = nls.localize('unicodeHighlight.disableHighlightingInComments.shortLabel', 'Disable Highlight In Comments');
    }
    async run(accessor, editor) {
        const configurationService = accessor.get(IConfigurationService);
        if (configurationService) {
            this.runAction(configurationService);
        }
    }
    async runAction(configurationService) {
        await configurationService.updateValue(unicodeHighlightConfigKeys.includeComments, false, 2 /* ConfigurationTarget.USER */);
    }
}
export class DisableHighlightingInStringsAction extends EditorAction {
    static { this.ID = 'editor.action.unicodeHighlight.disableHighlightingInStrings'; }
    constructor() {
        super({
            id: DisableHighlightingOfAmbiguousCharactersAction.ID,
            label: nls.localize2('action.unicodeHighlight.disableHighlightingInStrings', "Disable highlighting of characters in strings"),
            precondition: undefined
        });
        this.shortLabel = nls.localize('unicodeHighlight.disableHighlightingInStrings.shortLabel', 'Disable Highlight In Strings');
    }
    async run(accessor, editor) {
        const configurationService = accessor.get(IConfigurationService);
        if (configurationService) {
            this.runAction(configurationService);
        }
    }
    async runAction(configurationService) {
        await configurationService.updateValue(unicodeHighlightConfigKeys.includeStrings, false, 2 /* ConfigurationTarget.USER */);
    }
}
export class DisableHighlightingOfAmbiguousCharactersAction extends Action2 {
    static { this.ID = 'editor.action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters'; }
    constructor() {
        super({
            id: DisableHighlightingOfAmbiguousCharactersAction.ID,
            title: nls.localize2('action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters', "Disable highlighting of ambiguous characters"),
            precondition: undefined,
            f1: false,
        });
        this.shortLabel = nls.localize('unicodeHighlight.disableHighlightingOfAmbiguousCharacters.shortLabel', 'Disable Ambiguous Highlight');
    }
    async run(accessor, editor) {
        const configurationService = accessor.get(IConfigurationService);
        if (configurationService) {
            this.runAction(configurationService);
        }
    }
    async runAction(configurationService) {
        await configurationService.updateValue(unicodeHighlightConfigKeys.ambiguousCharacters, false, 2 /* ConfigurationTarget.USER */);
    }
}
export class DisableHighlightingOfInvisibleCharactersAction extends Action2 {
    static { this.ID = 'editor.action.unicodeHighlight.disableHighlightingOfInvisibleCharacters'; }
    constructor() {
        super({
            id: DisableHighlightingOfInvisibleCharactersAction.ID,
            title: nls.localize2('action.unicodeHighlight.disableHighlightingOfInvisibleCharacters', "Disable highlighting of invisible characters"),
            precondition: undefined,
            f1: false,
        });
        this.shortLabel = nls.localize('unicodeHighlight.disableHighlightingOfInvisibleCharacters.shortLabel', 'Disable Invisible Highlight');
    }
    async run(accessor, editor) {
        const configurationService = accessor.get(IConfigurationService);
        if (configurationService) {
            this.runAction(configurationService);
        }
    }
    async runAction(configurationService) {
        await configurationService.updateValue(unicodeHighlightConfigKeys.invisibleCharacters, false, 2 /* ConfigurationTarget.USER */);
    }
}
export class DisableHighlightingOfNonBasicAsciiCharactersAction extends Action2 {
    static { this.ID = 'editor.action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters'; }
    constructor() {
        super({
            id: DisableHighlightingOfNonBasicAsciiCharactersAction.ID,
            title: nls.localize2('action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters', "Disable highlighting of non basic ASCII characters"),
            precondition: undefined,
            f1: false,
        });
        this.shortLabel = nls.localize('unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters.shortLabel', 'Disable Non ASCII Highlight');
    }
    async run(accessor, editor) {
        const configurationService = accessor.get(IConfigurationService);
        if (configurationService) {
            this.runAction(configurationService);
        }
    }
    async runAction(configurationService) {
        await configurationService.updateValue(unicodeHighlightConfigKeys.nonBasicASCII, false, 2 /* ConfigurationTarget.USER */);
    }
}
export class ShowExcludeOptions extends Action2 {
    static { this.ID = 'editor.action.unicodeHighlight.showExcludeOptions'; }
    constructor() {
        super({
            id: ShowExcludeOptions.ID,
            title: nls.localize2('action.unicodeHighlight.showExcludeOptions', "Show Exclude Options"),
            precondition: undefined,
            f1: false,
        });
    }
    async run(accessor, args) {
        const { codePoint, reason, inString, inComment } = args;
        const char = String.fromCodePoint(codePoint);
        const quickPickService = accessor.get(IQuickInputService);
        const configurationService = accessor.get(IConfigurationService);
        function getExcludeCharFromBeingHighlightedLabel(codePoint) {
            if (InvisibleCharacters.isInvisibleCharacter(codePoint)) {
                return nls.localize('unicodeHighlight.excludeInvisibleCharFromBeingHighlighted', 'Exclude {0} (invisible character) from being highlighted', codePointToHex(codePoint));
            }
            return nls.localize('unicodeHighlight.excludeCharFromBeingHighlighted', 'Exclude {0} from being highlighted', `${codePointToHex(codePoint)} "${char}"`);
        }
        const options = [];
        if (reason.kind === 0 /* UnicodeHighlighterReasonKind.Ambiguous */) {
            for (const locale of reason.notAmbiguousInLocales) {
                options.push({
                    label: nls.localize("unicodeHighlight.allowCommonCharactersInLanguage", "Allow unicode characters that are more common in the language \"{0}\".", locale),
                    run: async () => {
                        excludeLocaleFromBeingHighlighted(configurationService, [locale]);
                    },
                });
            }
        }
        options.push({
            label: getExcludeCharFromBeingHighlightedLabel(codePoint),
            run: () => excludeCharFromBeingHighlighted(configurationService, [codePoint])
        });
        if (inComment) {
            const action = new DisableHighlightingInCommentsAction();
            options.push({ label: action.label, run: async () => action.runAction(configurationService) });
        }
        else if (inString) {
            const action = new DisableHighlightingInStringsAction();
            options.push({ label: action.label, run: async () => action.runAction(configurationService) });
        }
        function getTitle(options) {
            return typeof options.desc.title === 'string' ? options.desc.title : options.desc.title.value;
        }
        if (reason.kind === 0 /* UnicodeHighlighterReasonKind.Ambiguous */) {
            const action = new DisableHighlightingOfAmbiguousCharactersAction();
            options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
        }
        else if (reason.kind === 1 /* UnicodeHighlighterReasonKind.Invisible */) {
            const action = new DisableHighlightingOfInvisibleCharactersAction();
            options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
        }
        else if (reason.kind === 2 /* UnicodeHighlighterReasonKind.NonBasicAscii */) {
            const action = new DisableHighlightingOfNonBasicAsciiCharactersAction();
            options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
        }
        else {
            expectNever(reason);
        }
        const result = await quickPickService.pick(options, { title: configureUnicodeHighlightOptionsStr });
        if (result) {
            await result.run();
        }
    }
}
async function excludeCharFromBeingHighlighted(configurationService, charCodes) {
    const existingValue = configurationService.getValue(unicodeHighlightConfigKeys.allowedCharacters);
    let value;
    if ((typeof existingValue === 'object') && existingValue) {
        // eslint-disable-next-line local/code-no-any-casts
        value = existingValue;
    }
    else {
        value = {};
    }
    for (const charCode of charCodes) {
        value[String.fromCodePoint(charCode)] = true;
    }
    await configurationService.updateValue(unicodeHighlightConfigKeys.allowedCharacters, value, 2 /* ConfigurationTarget.USER */);
}
async function excludeLocaleFromBeingHighlighted(configurationService, locales) {
    const existingValue = configurationService.inspect(unicodeHighlightConfigKeys.allowedLocales).user?.value;
    let value;
    if ((typeof existingValue === 'object') && existingValue) {
        // Copy value, as the existing value is read only
        // eslint-disable-next-line local/code-no-any-casts
        value = Object.assign({}, existingValue);
    }
    else {
        value = {};
    }
    for (const locale of locales) {
        value[locale] = true;
    }
    await configurationService.updateValue(unicodeHighlightConfigKeys.allowedLocales, value, 2 /* ConfigurationTarget.USER */);
}
function expectNever(value) {
    throw new Error(`Unexpected value: ${value}`);
}
registerAction2(DisableHighlightingOfAmbiguousCharactersAction);
registerAction2(DisableHighlightingOfInvisibleCharactersAction);
registerAction2(DisableHighlightingOfNonBasicAsciiCharactersAction);
registerAction2(ShowExcludeOptions);
registerEditorContribution(UnicodeHighlighter.ID, UnicodeHighlighter, 1 /* EditorContributionInstantiation.AfterFirstRender */);
HoverParticipantRegistry.register(UnicodeHighlighterHoverParticipant);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pY29kZUhpZ2hsaWdodGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL3VuaWNvZGVIaWdobGlnaHRlci9icm93c2VyL3VuaWNvZGVIaWdobGlnaHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEtBQUssUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN2RixPQUFPLDBCQUEwQixDQUFDO0FBRWxDLE9BQU8sRUFBRSxZQUFZLEVBQW1DLDBCQUEwQixFQUFvQixNQUFNLHNDQUFzQyxDQUFDO0FBQ25KLE9BQU8sRUFBd0Isb0JBQW9CLEVBQWlELDBCQUEwQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFJaEwsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUUsT0FBTyxFQUFxRiwyQkFBMkIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pMLE9BQU8sRUFBRSxvQkFBb0IsRUFBNEIsTUFBTSwwQ0FBMEMsQ0FBQztBQUMxRyxPQUFPLEVBQWdDLHdCQUF3QixFQUF1RixNQUFNLG1DQUFtQyxDQUFDO0FBQ2hNLE9BQU8sRUFBRSxhQUFhLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZ0JBQWdCLEVB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