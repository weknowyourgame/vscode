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
var TextEditorService_1;
import { Event } from '../../../../base/common/event.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorExtensions, isResourceDiffEditorInput, isResourceSideBySideEditorInput, DEFAULT_EDITOR_ASSOCIATION, isResourceMergeEditorInput } from '../../../common/editor.js';
import { IUntitledTextEditorService } from '../../untitled/common/untitledTextEditorService.js';
import { Schemas } from '../../../../base/common/network.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { SideBySideEditorInput } from '../../../common/editor/sideBySideEditorInput.js';
import { TextResourceEditorInput } from '../../../common/editor/textResourceEditorInput.js';
import { UntitledTextEditorInput } from '../../untitled/common/untitledTextEditorInput.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../editor/common/editorResolverService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
export const ITextEditorService = createDecorator('textEditorService');
class FileEditorInputLeakError extends Error {
    constructor(message, stack) {
        super(message);
        this.name = 'FileEditorInputLeakError';
        this.stack = stack;
    }
}
let TextEditorService = class TextEditorService extends Disposable {
    static { TextEditorService_1 = this; }
    constructor(untitledTextEditorService, instantiationService, uriIdentityService, fileService, editorResolverService) {
        super();
        this.untitledTextEditorService = untitledTextEditorService;
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        this.fileService = fileService;
        this.editorResolverService = editorResolverService;
        this.editorInputCache = new ResourceMap();
        this.fileEditorFactory = Registry.as(EditorExtensions.EditorFactory).getFileEditorFactory();
        this.mapLeakToCounter = new Map();
        // Register the default editor to the editor resolver
        // service so that it shows up in the editors picker
        this.registerDefaultEditor();
    }
    registerDefaultEditor() {
        this._register(this.editorResolverService.registerEditor('*', {
            id: DEFAULT_EDITOR_ASSOCIATION.id,
            label: DEFAULT_EDITOR_ASSOCIATION.displayName,
            detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
            priority: RegisteredEditorPriority.builtin
        }, {}, {
            createEditorInput: editor => ({ editor: this.createTextEditor(editor) }),
            createUntitledEditorInput: untitledEditor => ({ editor: this.createTextEditor(untitledEditor) }),
            createDiffEditorInput: diffEditor => ({ editor: this.createTextEditor(diffEditor) })
        }));
    }
    async resolveTextEditor(input) {
        return this.createTextEditor(input);
    }
    createTextEditor(input) {
        // Merge Editor Not Supported (we fallback to showing the result only)
        if (isResourceMergeEditorInput(input)) {
            return this.createTextEditor(input.result);
        }
        // Diff Editor Support
        if (isResourceDiffEditorInput(input)) {
            const original = this.createTextEditor(input.original);
            const modified = this.createTextEditor(input.modified);
            return this.instantiationService.createInstance(DiffEditorInput, input.label, input.description, original, modified, undefined);
        }
        // Side by Side Editor Support
        if (isResourceSideBySideEditorInput(input)) {
            const primary = this.createTextEditor(input.primary);
            const secondary = this.createTextEditor(input.secondary);
            return this.instantiationService.createInstance(SideBySideEditorInput, input.label, input.description, secondary, primary);
        }
        // Untitled text file support
        const untitledInput = input;
        if (untitledInput.forceUntitled || !untitledInput.resource || (untitledInput.resource.scheme === Schemas.untitled)) {
            const untitledOptions = {
                languageId: untitledInput.languageId,
                initialValue: untitledInput.contents,
                encoding: untitledInput.encoding
            };
            // Untitled resource: use as hint for an existing untitled editor
            let untitledModel;
            if (untitledInput.resource?.scheme === Schemas.untitled) {
                untitledModel = this.untitledTextEditorService.create({ untitledResource: untitledInput.resource, ...untitledOptions });
            }
            // Other resource: use as hint for associated filepath
            else {
                untitledModel = this.untitledTextEditorService.create({ associatedResource: untitledInput.resource, ...untitledOptions });
            }
            return this.createOrGetCached(untitledModel.resource, () => this.instantiationService.createInstance(UntitledTextEditorInput, untitledModel));
        }
        // Text File/Resource Editor Support
        const textResourceEditorInput = input;
        if (textResourceEditorInput.resource instanceof URI) {
            // Derive the label from the path if not provided explicitly
            const label = textResourceEditorInput.label || basename(textResourceEditorInput.resource);
            // We keep track of the preferred resource this input is to be created
            // with but it may be different from the canonical resource (see below)
            const preferredResource = textResourceEditorInput.resource;
            // From this moment on, only operate on the canonical resource
            // to ensure we reduce the chance of opening the same resource
            // with different resource forms (e.g. path casing on Windows)
            const canonicalResource = this.uriIdentityService.asCanonicalUri(preferredResource);
            return this.createOrGetCached(canonicalResource, () => {
                // File
                if (textResourceEditorInput.forceFile || this.fileService.hasProvider(canonicalResource)) {
                    return this.fileEditorFactory.createFileEditor(canonicalResource, preferredResource, textResourceEditorInput.label, textResourceEditorInput.description, textResourceEditorInput.encoding, textResourceEditorInput.languageId, textResourceEditorInput.contents, this.instantiationService);
                }
                // Resource
                return this.instantiationService.createInstance(TextResourceEditorInput, canonicalResource, textResourceEditorInput.label, textResourceEditorInput.description, textResourceEditorInput.languageId, textResourceEditorInput.contents);
            }, cachedInput => {
                // Untitled
                if (cachedInput instanceof UntitledTextEditorInput) {
                    return;
                }
                // Files
                else if (!(cachedInput instanceof TextResourceEditorInput)) {
                    cachedInput.setPreferredResource(preferredResource);
                    if (textResourceEditorInput.label) {
                        cachedInput.setPreferredName(textResourceEditorInput.label);
                    }
                    if (textResourceEditorInput.description) {
                        cachedInput.setPreferredDescription(textResourceEditorInput.description);
                    }
                    if (textResourceEditorInput.encoding) {
                        cachedInput.setPreferredEncoding(textResourceEditorInput.encoding);
                    }
                    if (textResourceEditorInput.languageId) {
                        cachedInput.setPreferredLanguageId(textResourceEditorInput.languageId);
                    }
                    if (typeof textResourceEditorInput.contents === 'string') {
                        cachedInput.setPreferredContents(textResourceEditorInput.contents);
                    }
                }
                // Resources
                else {
                    if (label) {
                        cachedInput.setName(label);
                    }
                    if (textResourceEditorInput.description) {
                        cachedInput.setDescription(textResourceEditorInput.description);
                    }
                    if (textResourceEditorInput.languageId) {
                        cachedInput.setPreferredLanguageId(textResourceEditorInput.languageId);
                    }
                    if (typeof textResourceEditorInput.contents === 'string') {
                        cachedInput.setPreferredContents(textResourceEditorInput.contents);
                    }
                }
            });
        }
        throw new Error(`ITextEditorService: Unable to create texteditor from ${JSON.stringify(input)}`);
    }
    createOrGetCached(resource, factoryFn, cachedFn) {
        // Return early if already cached
        let input = this.editorInputCache.get(resource);
        if (input) {
            cachedFn?.(input);
            return input;
        }
        // Otherwise create and add to cache
        input = factoryFn();
        this.editorInputCache.set(resource, input);
        // Track Leaks
        const leakId = this.trackLeaks(input);
        Event.once(input.onWillDispose)(() => {
            // Remove from cache
            this.editorInputCache.delete(resource);
            // Untrack Leaks
            if (leakId) {
                this.untrackLeaks(leakId);
            }
        });
        return input;
    }
    //#region Leak Monitoring
    static { this.LEAK_TRACKING_THRESHOLD = 256; }
    static { this.LEAK_REPORTING_THRESHOLD = 2 * this.LEAK_TRACKING_THRESHOLD; }
    static { this.LEAK_REPORTED = false; }
    trackLeaks(input) {
        if (TextEditorService_1.LEAK_REPORTED || this.editorInputCache.size < TextEditorService_1.LEAK_TRACKING_THRESHOLD) {
            return undefined;
        }
        const leakId = `${input.resource.scheme}#${input.typeId || '<no typeId>'}#${input.editorId || '<no editorId>'}\n${new Error().stack?.split('\n').slice(2).join('\n') ?? ''}`;
        const leakCounter = (this.mapLeakToCounter.get(leakId) ?? 0) + 1;
        this.mapLeakToCounter.set(leakId, leakCounter);
        if (this.editorInputCache.size > TextEditorService_1.LEAK_REPORTING_THRESHOLD) {
            TextEditorService_1.LEAK_REPORTED = true;
            const [topLeak, topCount] = Array.from(this.mapLeakToCounter.entries()).reduce(([topLeak, topCount], [key, val]) => val > topCount ? [key, val] : [topLeak, topCount]);
            const message = `Potential text editor input LEAK detected, having ${this.editorInputCache.size} text editor inputs already. Most frequent owner (${topCount})`;
            onUnexpectedError(new FileEditorInputLeakError(message, topLeak));
        }
        return leakId;
    }
    untrackLeaks(leakId) {
        const stackCounter = (this.mapLeakToCounter.get(leakId) ?? 1) - 1;
        this.mapLeakToCounter.set(leakId, stackCounter);
        if (stackCounter === 0) {
            this.mapLeakToCounter.delete(leakId);
        }
    }
};
TextEditorService = TextEditorService_1 = __decorate([
    __param(0, IUntitledTextEditorService),
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService),
    __param(3, IFileService),
    __param(4, IEditorResolverService)
], TextEditorService);
export { TextEditorService };
registerSingleton(ITextEditorService, TextEditorService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEVkaXRvclNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0RWRpdG9yU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3BILE9BQU8sRUFBMEYsZ0JBQWdCLEVBQUUseUJBQXlCLEVBQUUsK0JBQStCLEVBQW9DLDBCQUEwQixFQUFFLDBCQUEwQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFM1MsT0FBTyxFQUFpQywwQkFBMEIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQy9ILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDNUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDeEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFM0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVB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