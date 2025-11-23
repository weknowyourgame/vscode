/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class ExtensionRecommendationNotificationServiceChannelClient {
    constructor(channel) {
        this.channel = channel;
    }
    get ignoredRecommendations() { throw new Error('not supported'); }
    promptImportantExtensionsInstallNotification(extensionRecommendations) {
        return this.channel.call('promptImportantExtensionsInstallNotification', [extensionRecommendations]);
    }
    promptWorkspaceRecommendations(recommendations) {
        throw new Error('not supported');
    }
    hasToIgnoreRecommendationNotifications() {
        throw new Error('not supported');
    }
}
export class ExtensionRecommendationNotificationServiceChannel {
    constructor(service) {
        this.service = service;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listen(_, event) {
        throw new Error(`Event not found: ${event}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call(_, command, args) {
        switch (command) {
            case 'promptImportantExtensionsInstallNotification': return this.service.promptImportantExtensionsInstallNotification(args[0]);
        }
        throw new Error(`Call not found: ${command}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zSXBjLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zSXBjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLE1BQU0sT0FBTyx1REFBdUQ7SUFJbkUsWUFBNkIsT0FBaUI7UUFBakIsWUFBTyxHQUFQLE9BQU8sQ0FBVTtJQUFJLENBQUM7SUFFbkQsSUFBSSxzQkFBc0IsS0FBZSxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU1RSw0Q0FBNEMsQ0FBQyx3QkFBbUQ7UUFDL0YsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztJQUN0RyxDQUFDO0lBRUQsOEJBQThCLENBQUMsZUFBeUI7UUFDdkQsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsc0NBQXNDO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDbEMsQ0FBQztDQUVEO0FBRUQsTUFBTSxPQUFPLGlEQUFpRDtJQUU3RCxZQUFvQixPQUFvRDtRQUFwRCxZQUFPLEdBQVAsT0FBTyxDQUE2QztJQUFJLENBQUM7SUFFN0UsOERBQThEO0lBQzlELE1BQU0sQ0FBQyxDQUFVLEVBQUUsS0FBYTtRQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCw4REFBOEQ7SUFDOUQsSUFBSSxDQUFDLENBQVUsRUFBRSxPQUFlLEVBQUUsSUFBVTtRQUMzQyxRQUFRLE9BQU8sRUFBRSxDQUFDO1lBQ2pCLEtBQUssOENBQThDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsNENBQTRDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEksQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNEIn0=