/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as extensionsRegistry from '../../../services/extensions/common/extensionsRegistry.js';
import { terminalContributionsDescriptor } from './terminal.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { Emitter } from '../../../../base/common/event.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { isObject, isString } from '../../../../base/common/types.js';
// terminal extension point
const terminalsExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint(terminalContributionsDescriptor);
export const ITerminalContributionService = createDecorator('terminalContributionsService');
export class TerminalContributionService {
    get terminalProfiles() { return this._terminalProfiles; }
    get terminalCompletionProviders() { return this._terminalCompletionProviders; }
    constructor() {
        this._terminalProfiles = [];
        this._terminalCompletionProviders = [];
        this._onDidChangeTerminalCompletionProviders = new Emitter();
        this.onDidChangeTerminalCompletionProviders = this._onDidChangeTerminalCompletionProviders.event;
        terminalsExtPoint.setHandler(contributions => {
            this._terminalProfiles = contributions.map(c => {
                return c.value?.profiles?.filter(p => hasValidTerminalIcon(p)).map(e => {
                    return { ...e, extensionIdentifier: c.description.identifier.value };
                }) || [];
            }).flat();
            this._terminalCompletionProviders = contributions.map(c => {
                if (!isProposedApiEnabled(c.description, 'terminalCompletionProvider')) {
                    return [];
                }
                return c.value?.completionProviders?.map(p => {
                    return { ...p, extensionIdentifier: c.description.identifier.value };
                }) || [];
            }).flat();
            this._onDidChangeTerminalCompletionProviders.fire();
        });
    }
}
function hasValidTerminalIcon(profile) {
    function isValidDarkLightIcon(obj) {
        return (isObject(obj) &&
            'light' in obj && URI.isUri(obj.light) &&
            'dark' in obj && URI.isUri(obj.dark));
    }
    return !profile.icon || (isString(profile.icon) ||
        URI.isUri(profile.icon) ||
        isValidDarkLightIcon(profile.icon));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFeHRlbnNpb25Qb2ludHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsRXh0ZW5zaW9uUG9pbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxrQkFBa0IsTUFBTSwyREFBMkQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDaEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTdGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDekYsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV0RSwyQkFBMkI7QUFDM0IsTUFBTSxpQkFBaUIsR0FBRyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBeUIsK0JBQStCLENBQUMsQ0FBQztBQWNoSixNQUFNLENBQUMsTUFBTSw0QkFBNEIsR0FBRyxlQUFlLENBQStCLDhCQUE4QixDQUFDLENBQUM7QUFFMUgsTUFBTSxPQUFPLDJCQUEyQjtJQUl2QyxJQUFJLGdCQUFnQixLQUFLLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztJQUd6RCxJQUFJLDJCQUEyQixLQUFLLE9BQU8sSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUMsQ0FBQztJQUsvRTtRQVRRLHNCQUFpQixHQUE2QyxFQUFFLENBQUM7UUFHakUsaUNBQTRCLEdBQXdELEVBQUUsQ0FBQztRQUc5RSw0Q0FBdUMsR0FBRyxJQUFJLE9BQU8sRUFBUSxDQUFDO1FBQ3RFLDJDQUFzQyxHQUFHLElBQUksQ0FBQyx1Q0FBdUMsQ0FBQyxLQUFLLENBQUM7UUFHcEcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQzVDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM5QyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUN0RSxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3RFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNWLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRVYsSUFBSSxDQUFDLDRCQUE0QixHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLDRCQUE0QixDQUFDLEVBQUUsQ0FBQztvQkFDeEUsT0FBTyxFQUFFLENBQUM7Z0JBQ1gsQ0FBQztnQkFDRCxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUM1QyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3RFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNWLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRVYsSUFBSSxDQUFDLHVDQUF1QyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztDQUNEO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxPQUFxQztJQUNsRSxTQUFTLG9CQUFvQixDQUFDLEdBQVk7UUFDekMsT0FBTyxDQUNOLFFBQVEsQ0FBQyxHQUFHLENBQUM7WUFDYixPQUFPLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUNwQyxDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQ3ZCLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQ3RCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN2QixvQkFBb0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQ2xDLENBQUM7QUFDSCxDQUFDIn0=