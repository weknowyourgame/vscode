/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../nls.js';
import { Emitter } from '../../../base/common/event.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Mimes } from '../../../base/common/mime.js';
import { Extensions as ConfigurationExtensions } from '../../../platform/configuration/common/configurationRegistry.js';
// Define extension point ids
export const Extensions = {
    ModesRegistry: 'editor.modesRegistry'
};
export class EditorModesRegistry extends Disposable {
    constructor() {
        super();
        this._onDidChangeLanguages = this._register(new Emitter());
        this.onDidChangeLanguages = this._onDidChangeLanguages.event;
        this._languages = [];
    }
    registerLanguage(def) {
        this._languages.push(def);
        this._onDidChangeLanguages.fire(undefined);
        return {
            dispose: () => {
                for (let i = 0, len = this._languages.length; i < len; i++) {
                    if (this._languages[i] === def) {
                        this._languages.splice(i, 1);
                        return;
                    }
                }
            }
        };
    }
    getLanguages() {
        return this._languages;
    }
}
export const ModesRegistry = new EditorModesRegistry();
Registry.add(Extensions.ModesRegistry, ModesRegistry);
export const PLAINTEXT_LANGUAGE_ID = 'plaintext';
export const PLAINTEXT_EXTENSION = '.txt';
ModesRegistry.registerLanguage({
    id: PLAINTEXT_LANGUAGE_ID,
    extensions: [PLAINTEXT_EXTENSION],
    aliases: [nls.localize('plainText.alias', "Plain Text"), 'text'],
    mimetypes: [Mimes.text]
});
Registry.as(ConfigurationExtensions.Configuration)
    .registerDefaultConfigurations([{
        overrides: {
            '[plaintext]': {
                'editor.unicodeHighlight.ambiguousCharacters': false,
                'editor.unicodeHighlight.invisibleCharacters': false
            },
            // TODO: Below is a workaround for: https://github.com/microsoft/vscode/issues/240567
            '[go]': {
                'editor.insertSpaces': false
            },
            '[makefile]': {
                'editor.insertSpaces': false,
            },
            '[shellscript]': {
                'files.eol': '\n'
            },
            '[yaml]': {
                'editor.insertSpaces': true,
                'editor.tabSize': 2
            }
        }
    }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZXNSZWdpc3RyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBRS9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFDNUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JELE9BQU8sRUFBMEIsVUFBVSxJQUFJLHVCQUF1QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFFaEosNkJBQTZCO0FBQzdCLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRztJQUN6QixhQUFhLEVBQUUsc0JBQXNCO0NBQ3JDLENBQUM7QUFFRixNQUFNLE9BQU8sbUJBQW9CLFNBQVEsVUFBVTtJQU9sRDtRQUNDLEtBQUssRUFBRSxDQUFDO1FBSlEsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDN0QseUJBQW9CLEdBQWdCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUM7UUFJcEYsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVNLGdCQUFnQixDQUFDLEdBQTRCO1FBQ25ELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsT0FBTztZQUNOLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDNUQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO3dCQUNoQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE9BQU87b0JBQ1IsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztTQUNELENBQUM7SUFDSCxDQUFDO0lBRU0sWUFBWTtRQUNsQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDeEIsQ0FBQztDQUNEO0FBRUQsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLElBQUksbUJBQW1CLEVBQUUsQ0FBQztBQUN2RCxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFFdEQsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsV0FBVyxDQUFDO0FBQ2pELE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQztBQUUxQyxhQUFhLENBQUMsZ0JBQWdCLENBQUM7SUFDOUIsRUFBRSxFQUFFLHFCQUFxQjtJQUN6QixVQUFVLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztJQUNqQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUNoRSxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0NBQ3ZCLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxFQUFFLENBQXlCLHVCQUF1QixDQUFDLGFBQWEsQ0FBQztLQUN4RSw2QkFBNkIsQ0FBQyxDQUFDO1FBQy9CLFNBQVMsRUFBRTtZQUNWLGFBQWEsRUFBRTtnQkFDZCw2Q0FBNkMsRUFBRSxLQUFLO2dCQUNwRCw2Q0FBNkMsRUFBRSxLQUFLO2FBQ3BEO1lBQ0QscUZBQXFGO1lBQ3JGLE1BQU0sRUFBRTtnQkFDUCxxQkFBcUIsRUFBRSxLQUFLO2FBQzVCO1lBQ0QsWUFBWSxFQUFFO2dCQUNiLHFCQUFxQixFQUFFLEtBQUs7YUFDNUI7WUFDRCxlQUFlLEVBQUU7Z0JBQ2hCLFdBQVcsRUFBRSxJQUFJO2FBQ2pCO1lBQ0QsUUFBUSxFQUFFO2dCQUNULHFCQUFxQixFQUFFLElBQUk7Z0JBQzNCLGdCQUFnQixFQUFFLENBQUM7YUFDbkI7U0FDRDtLQUNELENBQUMsQ0FBQyxDQUFDIn0=