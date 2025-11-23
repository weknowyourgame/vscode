/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../../base/common/uri.js';
import { McpServerLaunch } from '../mcpTypes.js';
export async function claudeConfigToServerDefinition(idPrefix, contents, cwd) {
    let parsed;
    try {
        parsed = JSON.parse(contents.toString());
    }
    catch {
        return;
    }
    return Promise.all(Object.entries(parsed.mcpServers).map(async ([name, server]) => {
        const launch = server.url ? {
            type: 2 /* McpServerTransportType.HTTP */,
            uri: URI.parse(server.url),
            headers: [],
        } : {
            type: 1 /* McpServerTransportType.Stdio */,
            args: server.args || [],
            command: server.command,
            env: server.env || {},
            envFile: undefined,
            cwd: cwd?.fsPath,
        };
        return {
            id: `${idPrefix}.${name}`,
            label: name,
            launch,
            cacheNonce: await McpServerLaunch.hash(launch),
        };
    }));
}
export class ClaudeDesktopMpcDiscoveryAdapter {
    constructor(remoteAuthority) {
        this.remoteAuthority = remoteAuthority;
        this.order = 400 /* McpCollectionSortOrder.Filesystem */;
        this.discoverySource = "claude-desktop" /* DiscoverySource.ClaudeDesktop */;
        this.id = `claude-desktop.${this.remoteAuthority}`;
    }
    getFilePath({ platform, winAppData, xdgHome, homedir }) {
        if (platform === 3 /* Platform.Windows */) {
            const appData = winAppData || URI.joinPath(homedir, 'AppData', 'Roaming');
            return URI.joinPath(appData, 'Claude', 'claude_desktop_config.json');
        }
        else if (platform === 1 /* Platform.Mac */) {
            return URI.joinPath(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        }
        else {
            const configDir = xdgHome || URI.joinPath(homedir, '.config');
            return URI.joinPath(configDir, 'Claude', 'claude_desktop_config.json');
        }
    }
    adaptFile(contents, { homedir }) {
        return claudeConfigToServerDefinition(this.id, contents, homedir);
    }
}
export class WindsurfDesktopMpcDiscoveryAdapter extends ClaudeDesktopMpcDiscoveryAdapter {
    constructor(remoteAuthority) {
        super(remoteAuthority);
        this.discoverySource = "windsurf" /* DiscoverySource.Windsurf */;
        this.id = `windsurf.${this.remoteAuthority}`;
    }
    getFilePath({ homedir }) {
        return URI.joinPath(homedir, '.codeium', 'windsurf', 'mcp_config.json');
    }
}
export class CursorDesktopMpcDiscoveryAdapter extends ClaudeDesktopMpcDiscoveryAdapter {
    constructor(remoteAuthority) {
        super(remoteAuthority);
        this.discoverySource = "cursor-global" /* DiscoverySource.CursorGlobal */;
        this.id = `cursor.${this.remoteAuthority}`;
    }
    getFilePath({ homedir }) {
        return URI.joinPath(homedir, '.cursor', 'mcp.json');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlTWNwRGlzY292ZXJ5QWRhcHRlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9kaXNjb3ZlcnkvbmF0aXZlTWNwRGlzY292ZXJ5QWRhcHRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBR3hELE9BQU8sRUFBK0MsZUFBZSxFQUEwQixNQUFNLGdCQUFnQixDQUFDO0FBWXRILE1BQU0sQ0FBQyxLQUFLLFVBQVUsOEJBQThCLENBQUMsUUFBZ0IsRUFBRSxRQUFrQixFQUFFLEdBQVM7SUFDbkcsSUFBSSxNQU9ILENBQUM7SUFFRixJQUFJLENBQUM7UUFDSixNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1IsT0FBTztJQUNSLENBQUM7SUFFRCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBeUMsRUFBRTtRQUN4SCxNQUFNLE1BQU0sR0FBb0IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDNUMsSUFBSSxxQ0FBNkI7WUFDakMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztZQUMxQixPQUFPLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxzQ0FBOEI7WUFDbEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRTtZQUN2QixPQUFPLEVBQUUsTUFBTSxD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