/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
export const IBreadcrumbsService = createDecorator('IEditorBreadcrumbsService');
export class BreadcrumbsService {
    constructor() {
        this._map = new Map();
    }
    register(group, widget) {
        if (this._map.has(group)) {
            throw new Error(`group (${group}) has already a widget`);
        }
        this._map.set(group, widget);
        return {
            dispose: () => this._map.delete(group)
        };
    }
    getWidget(group) {
        return this._map.get(group);
    }
}
registerSingleton(IBreadcrumbsService, BreadcrumbsService, 1 /* InstantiationType.Delayed */);
//#region config
export class BreadcrumbsConfig {
    constructor() {
        // internal
    }
    static { this.IsEnabled = BreadcrumbsConfig._stub('breadcrumbs.enabled'); }
    static { this.UseQuickPick = BreadcrumbsConfig._stub('breadcrumbs.useQuickPick'); }
    static { this.FilePath = BreadcrumbsConfig._stub('breadcrumbs.filePath'); }
    static { this.SymbolPath = BreadcrumbsConfig._stub('breadcrumbs.symbolPath'); }
    static { this.SymbolSortOrder = BreadcrumbsConfig._stub('breadcrumbs.symbolSortOrder'); }
    static { this.Icons = BreadcrumbsConfig._stub('breadcrumbs.icons'); }
    static { this.TitleScrollbarSizing = BreadcrumbsConfig._stub('workbench.editor.titleScrollbarSizing'); }
    static { this.TitleScrollbarVisibility = BreadcrumbsConfig._stub('workbench.editor.titleScrollbarVisibility'); }
    static { this.FileExcludes = BreadcrumbsConfig._stub('files.exclude'); }
    static _stub(name) {
        return {
            bindTo(service) {
                const onDidChange = new Emitter();
                const listener = service.onDidChangeConfiguration(e => {
                    if (e.affectsConfiguration(name)) {
                        onDidChange.fire(undefined);
                    }
                });
                return new class {
                    constructor() {
                        this.name = name;
                        this.onDidChange = onDidChange.event;
                    }
                    getValue(overrides) {
                        if (overrides) {
                            return service.getValue(name, overrides);
                        }
                        else {
                            return service.getValue(name);
                        }
                    }
                    updateValue(newValue, overrides) {
                        if (overrides) {
                            return service.updateValue(name, newValue, overrides);
                        }
                        else {
                            return service.updateValue(name, newValue);
                        }
                    }
                    dispose() {
                        listener.dispose();
                        onDidChange.dispose();
                    }
                };
            }
        };
    }
}
Registry.as(Extensions.Configuration).registerConfiguration({
    id: 'breadcrumbs',
    title: localize('title', "Breadcrumb Navigation"),
    order: 101,
    type: 'object',
    properties: {
        'breadcrumbs.enabled': {
            description: localize('enabled', "Enable/disable navigation breadcrumbs."),
            type: 'boolean',
            default: true
        },
        'breadcrumbs.filePath': {
            description: localize('filepath', "Controls whether and how file paths are shown in the breadcrumbs view."),
            type: 'string',
            default: 'on',
            enum: ['on', 'off', 'last'],
            enumDescriptions: [
                localize('filepath.on', "Show the file path in the breadcrumbs view."),
                localize('filepath.off', "Do not show the file path in the breadcrumbs view."),
                localize('filepath.last', "Only show the last element of the file path in the breadcrumbs view."),
            ]
        },
        'breadcrumbs.symbolPath': {
            description: localize('symbolpath', "Controls whether and how symbols are shown in the breadcrumbs view."),
            type: 'string',
            default: 'on',
            enum: ['on', 'off', 'last'],
            enumDescriptions: [
                localize('symbolpath.on', "Show all symbols in the breadcrumbs view."),
                localize('symbolpath.off', "Do not show symbols in the breadcrumbs view."),
                localize('symbolpath.last', "Only show the current symbol in the breadcrumbs view."),
            ]
        },
        'breadcrumbs.symbolSortOrder': {
            description: localize('symbolSortOrder', "Controls how symbols are sorted in the breadcrumbs outline view."),
            type: 'string',
            default: 'position',
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            enum: ['position', 'name', 'type'],
            enumDescriptions: [
                localize('symbolSortOrder.position', "Show symbol outline in file position order."),
                localize('symbolSortOrder.name', "Show symbol outline in alphabetical order."),
                localize('symbolSortOrder.type', "Show symbol outline in symbol type order."),
            ]
        },
        'breadcrumbs.icons': {
            description: localize('icons', "Render breadcrumb items with icons."),
            type: 'boolean',
            default: true
        },
        'breadcrumbs.showFiles': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.file', "When enabled breadcrumbs show `file`-symbols.")
        },
        'breadcrumbs.showModules': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.module', "When enabled breadcrumbs show `module`-symbols.")
        },
        'breadcrumbs.showNamespaces': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.namespace', "When enabled breadcrumbs show `namespace`-symbols.")
        },
        'breadcrumbs.showPackages': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.package', "When enabled breadcrumbs show `package`-symbols.")
        },
        'breadcrumbs.showClasses': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.class', "When enabled breadcrumbs show `class`-symbols.")
        },
        'breadcrumbs.showMethods': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.method', "When enabled breadcrumbs show `method`-symbols.")
        },
        'breadcrumbs.showProperties': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.property', "When enabled breadcrumbs show `property`-symbols.")
        },
        'breadcrumbs.showFields': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.field', "When enabled breadcrumbs show `field`-symbols.")
        },
        'breadcrumbs.showConstructors': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.constructor', "When enabled breadcrumbs show `constructor`-symbols.")
        },
        'breadcrumbs.showEnums': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.enum', "When enabled breadcrumbs show `enum`-symbols.")
        },
        'breadcrumbs.showInterfaces': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.interface', "When enabled breadcrumbs show `interface`-symbols.")
        },
        'breadcrumbs.showFunctions': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.function', "When enabled breadcrumbs show `function`-symbols.")
        },
        'breadcrumbs.showVariables': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.variable', "When enabled breadcrumbs show `variable`-symbols.")
        },
        'breadcrumbs.showConstants': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.constant', "When enabled breadcrumbs show `constant`-symbols.")
        },
        'breadcrumbs.showStrings': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.string', "When enabled breadcrumbs show `string`-symbols.")
        },
        'breadcrumbs.showNumbers': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.number', "When enabled breadcrumbs show `number`-symbols.")
        },
        'breadcrumbs.showBooleans': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.boolean', "When enabled breadcrumbs show `boolean`-symbols.")
        },
        'breadcrumbs.showArrays': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.array', "When enabled breadcrumbs show `array`-symbols.")
        },
        'breadcrumbs.showObjects': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.object', "When enabled breadcrumbs show `object`-symbols.")
        },
        'breadcrumbs.showKeys': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.key', "When enabled breadcrumbs show `key`-symbols.")
        },
        'breadcrumbs.showNull': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.null', "When enabled breadcrumbs show `null`-symbols.")
        },
        'breadcrumbs.showEnumMembers': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.enumMember', "When enabled breadcrumbs show `enumMember`-symbols.")
        },
        'breadcrumbs.showStructs': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.struct', "When enabled breadcrumbs show `struct`-symbols.")
        },
        'breadcrumbs.showEvents': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.event', "When enabled breadcrumbs show `event`-symbols.")
        },
        'breadcrumbs.showOperators': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.operator', "When enabled breadcrumbs show `operator`-symbols.")
        },
        'breadcrumbs.showTypeParameters': {
            type: 'boolean',
            default: true,
            scope: 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */,
            markdownDescription: localize('filteredTypes.typeParameter', "When enabled breadcrumbs show `typeParameter`-symbols.")
        }
    }
});
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJlYWRjcnVtYnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2JyZWFkY3J1bWJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUdsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUFFLFVBQVUsRUFBOEMsTUFBTSxvRUFBb0UsQ0FBQztBQUM1SSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUc1RSxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxlQUFlLENBQXNCLDJCQUEyQixDQUFDLENBQUM7QUFZckcsTUFBTSxPQUFPLGtCQUFrQjtJQUEvQjtRQUlrQixTQUFJLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7SUFlOUQsQ0FBQztJQWJBLFFBQVEsQ0FBQyxLQUFhLEVBQUUsTUFBeUI7UUFDaEQsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLHdCQUF3QixDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM3QixPQUFPO1lBQ04sT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztTQUN0QyxDQUFDO0lBQ0gsQ0FB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