/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { coalesce } from '../../../../base/common/arrays.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as nls from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { languagesExtPoint } from '../../../services/language/common/languageService.js';
const Fields = Object.freeze({
    viewType: 'viewType',
    displayName: 'displayName',
    selector: 'selector',
    priority: 'priority',
});
const customEditorsContributionSchema = {
    type: 'object',
    required: [
        Fields.viewType,
        Fields.displayName,
        Fields.selector,
    ],
    additionalProperties: false,
    properties: {
        [Fields.viewType]: {
            type: 'string',
            markdownDescription: nls.localize('contributes.viewType', 'Identifier for the custom editor. This must be unique across all custom editors, so we recommend including your extension id as part of `viewType`. The `viewType` is used when registering custom editors with `vscode.registerCustomEditorProvider` and in the `onCustomEditor:${id}` [activation event](https://code.visualstudio.com/api/references/activation-events).'),
        },
        [Fields.displayName]: {
            type: 'string',
            description: nls.localize('contributes.displayName', 'Human readable name of the custom editor. This is displayed to users when selecting which editor to use.'),
        },
        [Fields.selector]: {
            type: 'array',
            description: nls.localize('contributes.selector', 'Set of globs that the custom editor is enabled for.'),
            items: {
                type: 'object',
                defaultSnippets: [{
                        body: {
                            filenamePattern: '$1',
                        }
                    }],
                additionalProperties: false,
                properties: {
                    filenamePattern: {
                        type: 'string',
                        description: nls.localize('contributes.selector.filenamePattern', 'Glob that the custom editor is enabled for.'),
                    },
                }
            }
        },
        [Fields.priority]: {
            type: 'string',
            markdownDeprecationMessage: nls.localize('contributes.priority', 'Controls if the custom editor is enabled automatically when the user opens a file. This may be overridden by users using the `workbench.editorAssociations` setting.'),
            enum: [
                "default" /* CustomEditorPriority.default */,
                "option" /* CustomEditorPriority.option */,
            ],
            markdownEnumDescriptions: [
                nls.localize('contributes.priority.default', 'The editor is automatically used when the user opens a resource, provided that no other default custom editors are registered for that resource.'),
                nls.localize('contributes.priority.option', 'The editor is not automatically used when the user opens a resource, but a user can switch to the editor using the `Reopen With` command.'),
            ],
            default: "default" /* CustomEditorPriority.default */
        }
    }
};
export const customEditorsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'customEditors',
    deps: [languagesExtPoint],
    jsonSchema: {
        description: nls.localize('contributes.customEditors', 'Contributed custom editors.'),
        type: 'array',
        defaultSnippets: [{
                body: [{
                        [Fields.viewType]: '$1',
                        [Fields.displayName]: '$2',
                        [Fields.selector]: [{
                                filenamePattern: '$3'
                            }],
                    }]
            }],
        items: customEditorsContributionSchema
    },
    activationEventsGenerator: function* (contribs) {
        for (const contrib of contribs) {
            const viewType = contrib[Fields.viewType];
            if (viewType) {
                yield `onCustomEditor:${viewType}`;
            }
        }
    },
});
class CustomEditorsDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.customEditors;
    }
    render(manifest) {
        const customEditors = manifest.contributes?.customEditors || [];
        if (!customEditors.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            nls.localize('customEditors view type', "View Type"),
            nls.localize('customEditors priority', "Priority"),
            nls.localize('customEditors filenamePattern', "Filename Pattern"),
        ];
        const rows = customEditors
            .map(customEditor => {
            return [
                customEditor.viewType,
                customEditor.priority ?? '',
                coalesce(customEditor.selector.map(x => x.filenamePattern)).join(', ')
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'customEditors',
    label: nls.localize('customEditors', "Custom Editors"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(CustomEditorsDataRenderer),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uUG9pbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY3VzdG9tRWRpdG9yL2NvbW1vbi9leHRlbnNpb25Qb2ludC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFN0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFFMUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUU1RSxPQUFPLEVBQUUsVUFBVSxFQUFtRyxNQUFNLG1FQUFtRSxDQUFDO0FBQ2hNLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXpGLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDNUIsUUFBUSxFQUFFLFVBQVU7SUFDcEIsV0FBVyxFQUFFLGFBQWE7SUFDMUIsUUFBUSxFQUFFLFVBQVU7SUFDcEIsUUFBUSxFQUFFLFVBQVU7Q0FDcEIsQ0FBQyxDQUFDO0FBRUgsTUFBTSwrQkFBK0IsR0FBRztJQUN2QyxJQUFJLEVBQUUsUUFBUTtJQUNkLFFBQVEsRUFBRTtRQUNULE1BQU0sQ0FBQyxRQUFRO1FBQ2YsTUFBTSxDQUFDLFdBQVc7UUFDbEIsTUFBTSxDQUFDLFFBQVE7S0FDZjtJQUNELG9CQUFvQixFQUFFLEtBQUs7SUFDM0IsVUFBVSxFQUFFO1FBQ1gsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDbEIsSUFBSSxFQUFFLFFBQVE7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