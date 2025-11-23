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
import * as nls from '../../../../nls.js';
import { isObject } from '../../../../base/common/types.js';
import { IDebugService, debuggerDisabledMessage, DebugConfigurationProviderTriggerKind } from './debug.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import * as ConfigurationResolverUtils from '../../../services/configurationResolver/common/configurationResolverUtils.js';
import { ITextResourcePropertiesService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { isDebuggerMainContribution } from './debugUtils.js';
import { cleanRemoteAuthority } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { filter } from '../../../../base/common/objects.js';
let Debugger = class Debugger {
    constructor(adapterManager, dbgContribution, extensionDescription, configurationService, resourcePropertiesService, configurationResolverService, environmentService, debugService, contextKeyService) {
        this.adapterManager = adapterManager;
        this.configurationService = configurationService;
        this.resourcePropertiesService = resourcePropertiesService;
        this.configurationResolverService = configurationResolverService;
        this.environmentService = environmentService;
        this.debugService = debugService;
        this.contextKeyService = contextKeyService;
        this.mergedExtensionDescriptions = [];
        this.debuggerContribution = { type: dbgContribution.type };
        this.merge(dbgContribution, extensionDescription);
        this.debuggerWhen = typeof this.debuggerContribution.when === 'string' ? ContextKeyExpr.deserialize(this.debuggerContribution.when) : undefined;
        this.debuggerHiddenWhen = typeof this.debuggerContribution.hiddenWhen === 'string' ? ContextKeyExpr.deserialize(this.debuggerContribution.hiddenWhen) : undefined;
    }
    merge(otherDebuggerContribution, extensionDescription) {
        /**
         * Copies all properties of source into destination. The optional parameter "overwrite" allows to control
         * if existing non-structured properties on the destination should be overwritten or not. Defaults to true (overwrite).
         */
        function mixin(destination, source, overwrite, level = 0) {
            if (!isObject(destination)) {
                return source;
            }
            if (isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (key !== '__proto__') {
                        if (isObject(destination[key]) && isObject(source[key])) {
                            mixin(destination[key], source[key], overwrite, level + 1);
                        }
                        else {
                            if (key in destination) {
                                if (overwrite) {
                                    if (level === 0 && key === 'type') {
                                        // don't merge the 'type' property
                                    }
                                    else {
                                        destination[key] = source[key];
                                    }
                                }
                            }
                            else {
                                destination[key] = source[key];
                            }
                        }
                    }
                });
            }
            return destination;
        }
        // only if not already merged
        if (this.mergedExtensionDescriptions.indexOf(extensionDescription) < 0) {
            // remember all extensions that have been merged for this debugger
            this.mergedExtensionDescriptions.push(extensionDescription);
            // merge new debugger contribution into existing contributions (and don't overwrite values in built-in extensions)
            mixin(this.debuggerContribution, otherDebuggerContribution, extensionDescription.isBuiltin);
            // remember the extension that is considered the "main" debugger contribution
            if (isDebuggerMainContribution(otherDebuggerContribution)) {
                this.mainExtensionDescription = extensionDescription;
            }
        }
    }
    async startDebugging(configuration, parentSessionId) {
        const parentSession = this.debugService.getModel().getSession(parentSessionId);
        return await this.debugService.startDebugging(undefined, configuration, { parentSession }, undefined);
    }
    async createDebugAdapter(session) {
        await this.adapterManager.activateDebuggers('onDebugAdapterProtocolTracker', this.type);
        const da = this.adapterManager.createDebugAdapter(session);
        if (da) {
            return Promise.resolve(da);
        }
        throw new Error(nls.localize('cannot.find.da', "Cannot find debug adapter for type '{0}'.", this.type));
    }
    async substituteVariables(folder, config) {
        const substitutedConfig = await this.adapterManager.substituteVariables(this.type, folder, config);
        return await this.configurationResolverService.resolveWithInteractionReplace(folder, substitutedConfig, 'launch', this.variables, substitutedConfig.__configurationTarget);
    }
    runInTerminal(args, sessionId) {
        return this.adapterManager.runInTerminal(this.type, args, sessionId);
    }
    get label() {
        return this.debuggerContribution.label || this.debuggerContribution.type;
    }
    get type() {
        return this.debuggerContribution.type;
    }
    get variables() {
        return this.debuggerContribution.variables;
    }
    get configurationSnippets() {
        return this.debuggerContribution.configurationSnippets;
    }
    get languages() {
        return this.debuggerContribution.languages;
    }
    get when() {
        return this.debuggerWhen;
    }
    get hiddenWhen() {
        return this.debuggerHiddenWhen;
    }
    get enabled() {
        return !this.debuggerWhen || this.contextKeyService.contextMatchesRules(this.debuggerWhen);
    }
    get isHiddenFromDropdown() {
        if (!this.debuggerHiddenWhen) {
            return false;
        }
        return this.contextKeyService.contextMatchesRules(this.debuggerHiddenWhen);
    }
    get strings() {
        return this.debuggerContribution.strings ?? this.debuggerContribution.uiMessages;
    }
    interestedInLanguage(languageId) {
        return !!(this.languages && this.languages.indexOf(languageId) >= 0);
    }
    hasInitialConfiguration() {
        return !!this.debuggerContribution.initialConfigurations;
    }
    hasDynamicConfigurationProviders() {
        return this.debugService.getConfigurationManager().hasDebugConfigurationProvider(this.type, DebugConfigurationProviderTriggerKind.Dynamic);
    }
    hasConfigurationProvider() {
        return this.debugService.getConfigurationManager().hasDebugConfigurationProvider(this.type);
    }
    getInitialConfigurationContent(initialConfigs) {
        // at this point we got some configs from the package.json and/or from registered DebugConfigurationProviders
        let initialConfigurations = this.debuggerContribution.initialConfigurations || [];
        if (initialConfigs) {
            initialConfigurations = initialConfigurations.concat(initialConfigs);
        }
        const eol = this.resourcePropertiesService.getEOL(URI.from({ scheme: Schemas.untitled, path: '1' })) === '\r\n' ? '\r\n' : '\n';
        const configs = JSON.stringify(initialConfigurations, null, '\t').split('\n').map(line => '\t' + line).join(eol).trim();
        const comment1 = nls.localize('launch.config.comment1', "Use IntelliSense to learn about possible attributes.");
        const comment2 = nls.localize('launch.config.comment2', "Hover to view descriptions of existing attributes.");
        const comment3 = nls.localize('launch.config.comment3', "For more information, visit: {0}", 'https://go.microsoft.com/fwlink/?linkid=830387');
        let content = [
            '{',
            `\t// ${comment1}`,
            `\t// ${comment2}`,
            `\t// ${comment3}`,
            `\t"version": "0.2.0",`,
            `\t"configurations": ${configs}`,
            '}'
        ].join(eol);
        // fix formatting
        const editorConfig = this.configurationService.getValue();
        if (editorConfig.editor && editorConfig.editor.insertSpaces) {
            content = content.replace(new RegExp('\t', 'g'), ' '.repeat(editorConfig.editor.tabSize));
        }
        return Promise.resolve(content);
    }
    getMainExtensionDescriptor() {
        return this.mainExtensionDescription || this.mergedExtensionDescriptions[0];
    }
    getCustomTelemetryEndpoint() {
        const aiKey = this.debuggerContribution.aiKey;
        if (!aiKey) {
            return undefined;
        }
        const sendErrorTelemtry = cleanRemoteAuthority(this.environmentService.remoteAuthority) !== 'other';
        return {
            id: `${this.getMainExtensionDescriptor().publisher}.${this.type}`,
            aiKey,
            sendErrorTelemetry: sendErrorTelemtry
        };
    }
    getSchemaAttributes(definitions) {
        if (!this.debuggerContribution.configurationAttributes) {
            return null;
        }
        // fill in the default configuration attributes shared by all adapters.
        return Object.entries(this.debuggerContribution.configurationAttributes).map(([request, attributes]) => {
            const definitionId = `${this.type}:${request}`;
            const platformSpecificDefinitionId = `${this.type}:${request}:platform`;
            const defaultRequired = ['name', 'type', 'request'];
            attributes.required = attributes.required && attributes.required.length ? defaultRequired.concat(attributes.required) : defaultRequired;
            attributes.additionalProperties = false;
            attributes.type = 'object';
            if (!attributes.properties) {
                attributes.properties = {};
            }
            const properties = attributes.properties;
            properties['type'] = {
                enum: [this.type],
                enumDescriptions: [this.label],
                description: nls.localize('debugType', "Type of configuration."),
                pattern: '^(?!node2)',
                deprecationMessage: this.debuggerContribution.deprecated || (this.enabled ? undefined : debuggerDisabledMessage(this.type)),
                doNotSuggest: !!this.debuggerContribution.deprecated,
                errorMessage: nls.localize('debugTypeNotRecognised', "The debug type is not recognized. Make sure that you have a corresponding debug extension installed and that it is enabled."),
                patternErrorMessage: nls.localize('node2NotSupported', "\"node2\" is no longer supported, use \"node\" instead and set the \"protocol\" attribute to \"inspector\".")
            };
            properties['request'] = {
                enum: [request],
                description: nls.localize('debugRequest', "Request type of configuration. Can be \"launch\" or \"attach\"."),
            };
            for (const prop in definitions['common'].properties) {
                properties[prop] = {
                    $ref: `#/definitions/common/properties/${prop}`
                };
            }
            Object.keys(properties).forEach(name => {
                // Use schema allOf property to get independent error reporting #21113
                ConfigurationResolverUtils.applyDeprecatedVariableMessage(properties[name]);
            });
            definitions[definitionId] = { ...attributes };
            definitions[platformSpecificDefinitionId] = {
                type: 'object',
                additionalProperties: false,
                properties: filter(properties, key => key !== 'type' && key !== 'request' && key !== 'name')
            };
            // Don't add the OS props to the real attributes object so they don't show up in 'definitions'
            const attributesCopy = { ...attributes };
            attributesCopy.properties = {
                ...properties,
                ...{
                    windows: {
                        $ref: `#/definitions/${platformSpecificDefinitionId}`,
                        description: nls.localize('debugWindowsConfiguration', "Windows specific launch configuration attributes."),
                    },
                    osx: {
                        $ref: `#/definitions/${platformSpecificDefinitionId}`,
                        description: nls.localize('debugOSXConfiguration', "OS X specific launch configuration attributes."),
                    },
                    linux: {
                        $ref: `#/definitions/${platformSpecificDefinitionId}`,
                        description: nls.localize('debugLinuxConfiguration', "Linux specific launch configuration attributes."),
                    }
                }
            };
            return attributesCopy;
        });
    }
};
Debugger = __decorate([
    __param(3, IConfigurationService),
    __param(4, ITextResourcePropertiesService),
    __param(5, IConfigurationResolverService),
    __param(6, IWorkbenchEnvironmentService),
    __param(7, IDebugService),
    __param(8, IContextKeyService)
], Debugger);
export { Debugger };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdnZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvY29tbW9uL2RlYnVnZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRzVELE9BQU8sRUFBNEYsYUFBYSxFQUFFLHVCQUF1QixFQUFxQixxQ0FBcUMsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUN4TixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUN4SCxPQUFPLEtBQUssMEJBQTBCLE1BQU0sOEVBQThFLENBQUM7QUFDM0gsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDakgsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUc3RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsY0FBYyxFQUF3QixrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUVyRCxJQUFNLFFBQVEsR0FBZCxNQUFNLFFBQVE7SUFTcEIsWUFDUyxjQUErQixFQUN2QyxlQUFzQyxFQUN0QyxvQkFBMkMsRUFDcEIsb0JBQTRELEVBQ25ELHlCQUEwRSxFQUMzRSw0QkFBNEUsRUFDN0Usa0JBQWlFLEVBQ2hGLFlBQTRDLEVBQ3ZDLGlCQUFzRDtRQVJsRSxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFHQyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ2xDLDhCQUF5QixHQUF6Qix5QkFBeUIsQ0FBZ0M7UUFDMUQsaUNBQTRCLEdBQTVCLDRCQUE0QixDQUErQjtRQUM1RCx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQThCO1FBQy9ELGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQ3RCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFmbkUsZ0NBQTJCLEdBQTRCLEVBQUUsQ0FBQztRQWlCakUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUUsSUFBSSxFQUFFLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMzRCxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBRWxELElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNoSixJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNuSyxDQUFDO0lBRUQsS0FBSyxDQUFDLHlCQUFnRCxFQUFFLG9CQUEyQztRQUVsRzs7O1dBR0c7UUFDSCxTQUFTLEtBQUssQ0FBQyxXQUFnQixFQUFFLE1BQVcsRUFBRSxTQUFrQixFQUFFLEtBQUssR0FBRyxDQUFDO1lBRTFFLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsT0FBTyxNQUFNLENBQUM7WUFDZixDQUFDO1lBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ2pDLElBQUksR0FBRyxLQUFLLFdBQVcsRUFBRSxDQUFDO3dCQUN6QixJQUFJLFFBQVEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs0QkFDekQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsU0FBUyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDNUQsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLElBQUksR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dDQUN4QixJQUFJLFNBQVMsRUFBRSxDQUFDO29DQUNmLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFLENBQUM7d0NBQ25DLGtDQUFrQztvQ0FDbkMsQ0FBQzt5Q0FBTSxDQUFDO3dDQUNQLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0NBQ2hDLENBQUM7Z0NBQ0YsQ0FBQzs0QkFDRixDQUFDO2lDQUFNLENBQUM7Z0NBQ1AsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzs0QkFDaEMsQ0FBQzt3QkFDRixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDO1lBRUQsT0FBTyxXQUFXLENBQUM7UUFDcEIsQ0FBQztRQUVELDZCQUE2QjtRQUM3QixJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUV4RSxrRUFBa0U7WUFDbEUsSUFBSSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBRTVELGtIQUFrSDtZQUNsSCxLQUFLLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLHlCQUF5QixFQUFFLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTVGLDZFQUE2RTtZQUM3RSxJQUFJLDBCQUEwQixDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLHdCQUF3QixHQUFHLG9CQUFvQixDQUFDO1lBQ3RELENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBc0IsRUFBRSxlQUF1QjtRQUNuRSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMvRSxPQUFPLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxFQUFFLGFBQWEsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZHLENBQUM7SUFFRCxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBc0I7UUFDOUMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNELElBQUksRUFBRSxFQUFFLENBQUM7WUFDUixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSwyQ0FBMkMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RyxDQUFDO0lBRUQsS0FBSyxDQUFDLG1CQUFtQixDQUFDLE1BQW9DLEVBQUUsTUFBZTtRQUM5RSxNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuRyxPQUFPLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLDZCQUE2QixDQUFDLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzVLLENBQUM7SUFFRCxhQUFhLENBQUMsSUFBaUQsRUFBRSxTQUFpQjtRQUNqRixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQztJQUMxRSxDQUFDO0lBRUQsSUFBSSxJQUFJO1FBQ1AsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxJQUFJLFNBQVM7UUFDWixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQUkscUJBQXFCO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDO0lBQ3hELENBQUM7SUFFRCxJQUFJLFNBQVM7UUFDWixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQUksSUFBSTtRQUNQLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUMxQixDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ2IsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksT0FBTztRQUNWLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVELElBQUksb0JBQW9CO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM5QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUM7SUFDbEYsQ0FBQztJQUVELG9CQUFvQixDQUFDLFVBQWtCO1FBQ3RDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsdUJBQXVCO1FBQ3RCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQztJQUMxRCxDQUFDO0lBRUQsZ0NBQWdDO1FBQy9CLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUNBQXFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDNUksQ0FBQztJQUVELHdCQUF3QjtRQUN2QixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVELDhCQUE4QixDQUFDLGNBQTBCO1FBQ3hELDZHQUE2RztRQUM3RyxJQUFJLHFCQUFxQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsSUFBSSxFQUFFLENBQUM7UUFDbEYsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixxQkFBcUIsR0FBRyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUVELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNoSSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN4SCxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLHNEQUFzRCxDQUFDLENBQUM7UUFDaEgsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxvREFBb0QsQ0FBQyxDQUFDO1FBQzlHLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsa0NBQWtDLEVBQUUsZ0RBQWdELENBQUMsQ0FBQztRQUU5SSxJQUFJLE9BQU8sR0FBRztZQUNiLEdBQUc7WUFDSCxRQUFRLFFBQVEsRUFBRTtZQUNsQixRQUFRLFFBQVEsRUFBRTtZQUNsQixRQUFRLFFBQVEsRUFBRTtZQUNsQix1QkFBdUI7WUFDdkIsdUJBQXVCLE9BQU8sRUFBRTtZQUNoQyxHQUFHO1NBQ0gsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFWixpQkFBaUI7UUFDakIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsRUFBTyxDQUFDO1FBQy9ELElBQUksWUFBWSxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzdELE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMzRixDQUFDO1FBRUQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCwwQkFBMEI7UUFDekIsT0FBTyxJQUFJLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCwwQkFBMEI7UUFDekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQztRQUM5QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDLEtBQUssT0FBTyxDQUFDO1FBQ3BHLE9BQU87WUFDTixFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtZQUNqRSxLQUFLO1lBQ0wsa0JBQWtCLEVBQUUsaUJBQWlCO1NBQ3JDLENBQUM7SUFDSCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsV0FBMkI7UUFFOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3hELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELHVFQUF1RTtRQUN2RSxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHVCQUF1QixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtZQUN0RyxNQUFNLFlBQVksR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksT0FBTyxFQUFFLENBQUM7WUFDL0MsTUFBTSw0QkFBNEIsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksT0FBTyxXQUFXLENBQUM7WUFDeEUsTUFBTSxlQUFlLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3BELFVBQVUsQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLFFBQVEsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUN4SSxVQUFVLENBQUMsb0JBQW9CLEdBQUcsS0FBSyxDQUFDO1lBQ3hDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO1lBQzNCLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQzVCLFVBQVUsQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO1lBQzVCLENBQUM7WUFDRCxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO1lBQ3pDLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRztnQkFDcEIsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDakIsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUM5QixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsd0JBQXdCLENBQUM7Z0JBQ2hFLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixrQkFBa0IsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNILFlBQVksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVU7Z0JBQ3BELFlBQVksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLDZIQUE2SCxDQUFDO2dCQUNuTCxtQkFBbUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLDZHQUE2RyxDQUFDO2FBQ3JLLENBQUM7WUFDRixVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUc7Z0JBQ3ZCLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQztnQkFDZixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsaUVBQWlFLENBQUM7YUFDNUcsQ0FBQztZQUNGLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNyRCxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUc7b0JBQ2xCLElBQUksRUFBRSxtQ0FBbUMsSUFBSSxFQUFFO2lCQUMvQyxDQUFDO1lBQ0gsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN0QyxzRUFBc0U7Z0JBQ3RFLDBCQUEwQixDQUFDLDhCQUE4QixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzdFLENBQUMsQ0FBQyxDQUFDO1lBRUgsV0FBVyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxVQUFVLEVBQUUsQ0FBQztZQUM5QyxXQUFXLENBQUMsNEJBQTRCLENBQUMsR0FBRztnQkFDM0MsSUFBSSxFQUFFLFFBQVE7Z0JBQ2Qsb0JBQW9CLEVBQUUsS0FBSztnQkFDM0IsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssTUFBTSxJQUFJLEdBQUcsS0FBSyxTQUFTLElBQUksR0FBRyxLQUFLLE1BQU0sQ0FBQzthQUM1RixDQUFDO1lBRUYsOEZBQThGO1lBQzlGLE1BQU0sY0FBYyxHQUFHLEVBQUUsR0FBRyxVQUFVLEVBQUUsQ0FBQztZQUN6QyxjQUFjLENBQUMsVUFBVSxHQUFHO2dCQUMzQixHQUFHLFVBQVU7Z0JBQ2IsR0FBRztvQkFDRixPQUFPLEVBQUU7d0JBQ1IsSUFBSSxFQUFFLGlCQUFpQiw0QkFBNEIsRUFBRTt3QkFDckQsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsbURBQW1ELENBQUM7cUJBQzNHO29CQUNELEdBQUcsRUFBRTt3QkFDSixJQUFJLEVBQUUsaUJBQWlCLDRCQUE0QixFQUFFO3dCQUNyRCxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxnREFBZ0QsQ0FBQztxQkFDcEc7b0JBQ0QsS0FBSyxFQUFFO3dCQUNOLElBQUksRUFBRSxpQkFBaUIsNEJBQTRCLEVBQUU7d0JBQ3JELFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHlCQUF5QixFQUFFLGlEQUFpRCxDQUFDO3FCQUN2RztpQkFDRDthQUNELENBQUM7WUFFRixPQUFPLGNBQWMsQ0FBQztRQUN2QixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRCxDQUFBO0FBNVJZLFFBQVE7SUFhbEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLDhCQUE4QixDQUFBO0lBQzlCLFdBQUEsNkJBQTZCLENBQUE7SUFDN0IsV0FBQSw0QkFBNEIsQ0FBQTtJQUM1QixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsa0JBQWtCLENBQUE7R0FsQlIsUUFBUSxDQTRScEIifQ==