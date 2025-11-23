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
import { AsyncIterableProducer } from '../../../../base/common/async.js';
import { isEmptyMarkdownString, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Position } from '../../../common/core/position.js';
import { ModelDecorationInjectedTextOptions } from '../../../common/model/textModel.js';
import { HoverForeignElementAnchor } from '../../hover/browser/hoverTypes.js';
import { ITextModelService } from '../../../common/services/resolverService.js';
import { getHoverProviderResultsAsAsyncIterable } from '../../hover/browser/getHover.js';
import { MarkdownHover, MarkdownHoverParticipant } from '../../hover/browser/markdownHoverParticipant.js';
import { RenderedInlayHintLabelPart, InlayHintsController } from './inlayHintsController.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { localize } from '../../../../nls.js';
import * as platform from '../../../../base/common/platform.js';
import { asCommandLink } from './inlayHints.js';
import { isNonEmptyArray } from '../../../../base/common/arrays.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
class InlayHintsHoverAnchor extends HoverForeignElementAnchor {
    constructor(part, owner, initialMousePosX, initialMousePosY) {
        super(10, owner, part.item.anchor.range, initialMousePosX, initialMousePosY, true);
        this.part = part;
    }
}
let InlayHintsHover = class InlayHintsHover extends MarkdownHoverParticipant {
    constructor(editor, markdownRendererService, keybindingService, hoverService, configurationService, _resolverService, languageFeaturesService, commandService) {
        super(editor, markdownRendererService, configurationService, languageFeaturesService, keybindingService, hoverService, commandService);
        this._resolverService = _resolverService;
        this.hoverOrdinal = 6;
    }
    suggestHoverAnchor(mouseEvent) {
        const controller = InlayHintsController.get(this._editor);
        if (!controller) {
            return null;
        }
        if (mouseEvent.target.type !== 6 /* MouseTargetType.CONTENT_TEXT */) {
            return null;
        }
        const options = mouseEvent.target.detail.injectedText?.options;
        if (!(options instanceof ModelDecorationInjectedTextOptions && options.attachedData instanceof RenderedInlayHintLabelPart)) {
            return null;
        }
        return new InlayHintsHoverAnchor(options.attachedData, this, mouseEvent.event.posx, mouseEvent.event.posy);
    }
    computeSync() {
        return [];
    }
    computeAsync(anchor, _lineDecorations, source, token) {
        if (!(anchor instanceof InlayHintsHoverAnchor)) {
            return AsyncIterableProducer.EMPTY;
        }
        return new AsyncIterableProducer(async (executor) => {
            const { part } = anchor;
            await part.item.resolve(token);
            if (token.isCancellationRequested) {
                return;
            }
            // (1) Inlay Tooltip
            let itemTooltip;
            if (typeof part.item.hint.tooltip === 'string') {
                itemTooltip = new MarkdownString().appendText(part.item.hint.tooltip);
            }
            else if (part.item.hint.tooltip) {
                itemTooltip = part.item.hint.tooltip;
            }
            if (itemTooltip) {
                executor.emitOne(new MarkdownHover(this, anchor.range, [itemTooltip], false, 0));
            }
            // (1.2) Inlay dbl-click gesture
            if (isNonEmptyArray(part.item.hint.textEdits)) {
                executor.emitOne(new MarkdownHover(this, anchor.range, [new MarkdownString().appendText(localize('hint.dbl', "Double-click to insert"))], false, 10001));
            }
            // (2) Inlay Label Part Tooltip
            let partTooltip;
            if (typeof part.part.tooltip === 'string') {
                partTooltip = new MarkdownString().appendText(part.part.tooltip);
            }
            else if (part.part.tooltip) {
                partTooltip = part.part.tooltip;
            }
            if (partTooltip) {
                executor.emitOne(new MarkdownHover(this, anchor.range, [partTooltip], false, 1));
            }
            // (2.2) Inlay Label Part Help Hover
            if (part.part.location || part.part.command) {
                let linkHint;
                const useMetaKey = this._editor.getOption(86 /* EditorOption.multiCursorModifier */) === 'altKey';
                const kb = useMetaKey
                    ? platform.isMacintosh
                        ? localize('links.navigate.kb.meta.mac', "cmd + click")
                        : localize('links.navigate.kb.meta', "ctrl + click")
                    : platform.isMacintosh
                        ? localize('links.navigate.kb.alt.mac', "option + click")
                        : localize('links.navigate.kb.alt', "alt + click");
                if (part.part.location && part.part.command) {
                    linkHint = new MarkdownString().appendText(localize('hint.defAndCommand', 'Go to Definition ({0}), right click for more', kb));
                }
                else if (part.part.location) {
                    linkHint = new MarkdownString().appendText(localize('hint.def', 'Go to Definition ({0})', kb));
                }
                else if (part.part.command) {
                    linkHint = new MarkdownString(`[${localize('hint.cmd', "Execute Command")}](${asCommandLink(part.part.command)} "${part.part.command.title}") (${kb})`, { isTrusted: true });
                }
                if (linkHint) {
                    executor.emitOne(new MarkdownHover(this, anchor.range, [linkHint], false, 10000));
                }
            }
            // (3) Inlay Label Part Location tooltip
            const iterable = this._resolveInlayHintLabelPartHover(part, token);
            for await (const item of iterable) {
                executor.emitOne(item);
            }
        });
    }
    async *_resolveInlayHintLabelPartHover(part, token) {
        if (!part.part.location) {
            return;
        }
        const { uri, range } = part.part.location;
        const ref = await this._resolverService.createModelReference(uri);
        try {
            const model = ref.object.textEditorModel;
            if (!this._languageFeaturesService.hoverProvider.has(model)) {
                return;
            }
            for await (const item of getHoverProviderResultsAsAsyncIterable(this._languageFeaturesService.hoverProvider, model, new Position(range.startLineNumber, range.startColumn), token)) {
                if (!isEmptyMarkdownString(item.hover.contents)) {
                    yield new MarkdownHover(this, part.item.anchor.range, item.hover.contents, false, 2 + item.ordinal);
                }
            }
        }
        finally {
            ref.dispose();
        }
    }
};
InlayHintsHover = __decorate([
    __param(1, IMarkdownRendererService),
    __param(2, IKeybindingService),
    __param(3, IHoverService),
    __param(4, IConfigurationService),
    __param(5, ITextModelService),
    __param(6, ILanguageFeaturesService),
    __param(7, ICommandService)
], InlayHintsHover);
export { InlayHintsHover };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5sYXlIaW50c0hvdmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGF5SGludHMvYnJvd3Nlci9pbmxheUhpbnRzSG92ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFekUsT0FBTyxFQUFtQixxQkFBcUIsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVoSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFNUQsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEYsT0FBTyxFQUFlLHlCQUF5QixFQUEyQixNQUFNLG1DQUFtQyxDQUFDO0FBQ3BILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxzQ0FBc0MsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV4RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxLQUFLLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDaEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FB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