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
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { editorConfigurationBaseNode } from '../../../../editor/common/config/editorConfigurationSchema.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { pasteAsCommandId } from '../../../../editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js';
import { pasteAsPreferenceConfig } from '../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js';
import { dropAsPreferenceConfig } from '../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js';
import * as nls from '../../../../nls.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
const dropEnumValues = [];
const dropAsPreferenceSchema = {
    type: 'array',
    scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
    description: nls.localize('dropPreferredDescription', "Configures the preferred type of edit to use when dropping content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
    default: [],
    items: {
        description: nls.localize('dropKind', "The kind identifier of the drop edit."),
        anyOf: [
            { type: 'string' },
            { enum: dropEnumValues }
        ],
    }
};
const pasteEnumValues = [];
const pasteAsPreferenceSchema = {
    type: 'array',
    scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
    description: nls.localize('pastePreferredDescription', "Configures the preferred type of edit to use when pasting content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
    default: [],
    items: {
        description: nls.localize('pasteKind', "The kind identifier of the paste edit."),
        anyOf: [
            { type: 'string' },
            { enum: pasteEnumValues }
        ]
    }
};
export const editorConfiguration = Object.freeze({
    ...editorConfigurationBaseNode,
    properties: {
        [pasteAsPreferenceConfig]: pasteAsPreferenceSchema,
        [dropAsPreferenceConfig]: dropAsPreferenceSchema,
    }
});
let DropOrPasteSchemaContribution = class DropOrPasteSchemaContribution extends Disposable {
    static { this.ID = 'workbench.contrib.dropOrPasteIntoSchema'; }
    constructor(keybindingService, languageFeatures) {
        super();
        this.languageFeatures = languageFeatures;
        this._onDidChangeSchemaContributions = this._register(new Emitter());
        this._allProvidedDropKinds = [];
        this._allProvidedPasteKinds = [];
        this._register(Event.runAndSubscribe(Event.debounce(Event.any(languageFeatures.documentPasteEditProvider.onDidChange, languageFeatures.documentPasteEditProvider.onDidChange), () => { }, 1000), () => {
            this.updateProvidedKinds();
            this.updateConfigurationSchema();
            this._onDidChangeSchemaContributions.fire();
        }));
        this._register(keybindingService.registerSchemaContribution({
            getSchemaAdditions: () => this.getKeybindingSchemaAdditions(),
            onDidChange: this._onDidChangeSchemaContributions.event,
        }));
    }
    updateProvidedKinds() {
        // Drop
        const dropKinds = new Map();
        for (const provider of this.languageFeatures.documentDropEditProvider.allNoModel()) {
            for (const kind of provider.providedDropEditKinds ?? []) {
                dropKinds.set(kind.value, kind);
            }
        }
        this._allProvidedDropKinds = Array.from(dropKinds.values());
        // Paste
        const pasteKinds = new Map();
        for (const provider of this.languageFeatures.documentPasteEditProvider.allNoModel()) {
            for (const kind of provider.providedPasteEditKinds ?? []) {
                pasteKinds.set(kind.value, kind);
            }
        }
        this._allProvidedPasteKinds = Array.from(pasteKinds.values());
    }
    updateConfigurationSchema() {
        pasteEnumValues.length = 0;
        for (const codeActionKind of this._allProvidedPasteKinds) {
            pasteEnumValues.push(codeActionKind.value);
        }
        dropEnumValues.length = 0;
        for (const codeActionKind of this._allProvidedDropKinds) {
            dropEnumValues.push(codeActionKind.value);
        }
        Registry.as(Extensions.Configuration)
            .notifyConfigurationSchemaUpdated(editorConfiguration);
    }
    getKeybindingSchemaAdditions() {
        return [
            {
                if: {
                    required: ['command'],
                    properties: {
                        'command': { const: pasteAsCommandId }
                    }
                },
                then: {
                    properties: {
                        'args': {
                            oneOf: [
                                {
                                    required: ['kind'],
                                    properties: {
                                        'kind': {
                                            anyOf: [
                                                { enum: Array.from(this._allProvidedPasteKinds.map(x => x.value)) },
                                                { type: 'string' },
                                            ]
                                        }
                                    }
                                },
                                {
                                    required: ['preferences'],
                                    properties: {
                                        'preferences': {
                                            type: 'array',
                                            items: {
                                                anyOf: [
                                                    { enum: Array.from(this._allProvidedPasteKinds.map(x => x.value)) },
                                                    { type: 'string' },
                                                ]
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
        ];
    }
};
DropOrPasteSchemaContribution = __decorate([
    __param(0, IKeybindingService),
    __param(1, ILanguageFeaturesService)
], DropOrPasteSchemaContribution);
export { DropOrPasteSchemaContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvblNjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb25maWd1cmF0aW9uU2NoZW1hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFHbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZFQUE2RSxDQUFDO0FBQy9HLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJFQUEyRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLGdGQUFnRixDQUFDO0FBQ3hILE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFzQixVQUFVLEVBQTRFLE1BQU0sb0VBQW9FLENBQUM7QUFDOUwsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRzVFLE1BQU0sY0FBYyxHQUFhLEVBQUUsQ0FBQztBQUVwQyxNQUFNLHNCQUFzQixHQUFpQztJQUM1RCxJQUFJLEVBQUUsT0FBTztJQUNiLEtBQUssaURBQXlDO0lBQzlDLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLDBLQUEwSyxDQUFDO0lBQ2pPLE9BQU8sRUFBRSxFQUFFO0lBQ1gsS0FBSyxFQUFF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