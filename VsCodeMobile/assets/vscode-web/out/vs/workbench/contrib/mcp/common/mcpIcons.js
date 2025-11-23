/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getMediaMime } from '../../../../base/common/mime.js';
import { URI } from '../../../../base/common/uri.js';
const mcpAllowableContentTypes = [
    'image/webp',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif'
];
var IconTheme;
(function (IconTheme) {
    IconTheme[IconTheme["Light"] = 0] = "Light";
    IconTheme[IconTheme["Dark"] = 1] = "Dark";
    IconTheme[IconTheme["Any"] = 2] = "Any";
})(IconTheme || (IconTheme = {}));
function validateIcon(icon, launch, logger) {
    const mimeType = icon.mimeType?.toLowerCase() || getMediaMime(icon.src);
    if (!mimeType || !mcpAllowableContentTypes.includes(mimeType)) {
        logger.debug(`Ignoring icon with unsupported mime type: ${icon.src} (${mimeType}), allowed: ${mcpAllowableContentTypes.join(', ')}`);
        return;
    }
    const uri = URI.parse(icon.src);
    if (uri.scheme === 'data') {
        return uri;
    }
    if (uri.scheme === 'https' || uri.scheme === 'http') {
        if (launch.type !== 2 /* McpServerTransportType.HTTP */) {
            logger.debug(`Ignoring icon with HTTP/HTTPS URL: ${icon.src} as the MCP server is not launched with HTTP transport.`);
            return;
        }
        const expectedAuthority = launch.uri.authority.toLowerCase();
        if (uri.authority.toLowerCase() !== expectedAuthority) {
            logger.debug(`Ignoring icon with untrusted authority: ${icon.src}, expected authority: ${expectedAuthority}`);
            return;
        }
        return uri;
    }
    if (uri.scheme === 'file') {
        if (launch.type !== 1 /* McpServerTransportType.Stdio */) {
            logger.debug(`Ignoring icon with file URL: ${icon.src} as the MCP server is not launched as a local process.`);
            return;
        }
        return uri;
    }
    logger.debug(`Ignoring icon with unsupported scheme: ${icon.src}. Allowed: data:, http:, https:, file:`);
    return;
}
export function parseAndValidateMcpIcon(icons, launch, logger) {
    const result = [];
    for (const icon of icons.icons || []) {
        const uri = validateIcon(icon, launch, logger);
        if (!uri) {
            continue;
        }
        const sizesArr = typeof icon.sizes === 'string' ? icon.sizes.split(' ') : Array.isArray(icon.sizes) ? icon.sizes : [];
        result.push({
            src: uri,
            theme: icon.theme === 'light' ? 0 /* IconTheme.Light */ : icon.theme === 'dark' ? 1 /* IconTheme.Dark */ : 2 /* IconTheme.Any */,
            sizes: sizesArr.map(size => {
                const [widthStr, heightStr] = size.toLowerCase().split('x');
                return { width: Number(widthStr) || 0, height: Number(heightStr) || 0 };
            }).sort((a, b) => a.width - b.width)
        });
    }
    result.sort((a, b) => a.sizes[0]?.width - b.sizes[0]?.width);
    return result;
}
export class McpIcons {
    static fromStored(icons) {
        return McpIcons.fromParsed(icons?.map(i => ({ src: URI.revive(i.src), theme: i.theme, sizes: i.sizes })));
    }
    static fromParsed(icons) {
        return new McpIcons(icons || []);
    }
    constructor(_icons) {
        this._icons = _icons;
    }
    getUrl(size) {
        const dark = this.getSizeWithTheme(size, 1 /* IconTheme.Dark */);
        if (dark?.theme === 2 /* IconTheme.Any */) {
            return { dark: dark.src };
        }
        const light = this.getSizeWithTheme(size, 0 /* IconTheme.Light */);
        if (!light && !dark) {
            return undefined;
        }
        return { dark: (dark || light).src, light: light?.src };
    }
    getSizeWithTheme(size, theme) {
        let bestOfAnySize;
        for (const icon of this._icons) {
            if (icon.theme === theme || icon.theme === 2 /* IconTheme.Any */ || icon.theme === undefined) { // undefined check for back compat
                bestOfAnySize = icon;
                const matchingSize = icon.sizes.find(s => s.width >= size);
                if (matchingSize) {
                    return { ...icon, sizes: [matchingSize] };
                }
            }
        }
        return bestOfAnySize;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwSWNvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BJY29ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBTXJELE1BQU0sd0JBQXdCLEdBQXNCO0lBQ25ELFlBQVk7SUFDWixXQUFXO0lBQ1gsWUFBWTtJQUNaLFdBQVc7SUFDWCxXQUFXO0NBQ1gsQ0FBQztBQUVGLElBQVcsU0FJVjtBQUpELFdBQVcsU0FBUztJQUNuQiwyQ0FBSyxDQUFBO0lBQ0wseUNBQUksQ0FBQTtJQUNKLHVDQUFHLENBQUE7QUFDSixDQUFDLEVBSlUsU0FBUyxLQUFULFNBQVMsUUFJbkI7QUFlRCxTQUFTLFlBQVksQ0FBQyxJQUFjLEVBQUUsTUFBdUIsRUFBRSxNQUFlO0lBQzdFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4RSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsd0JBQXdCLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDL0QsTUFBTSxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsSUFBSSxDQUFDLEdBQUcsS0FBSyxRQUFRLGVBQWUsd0JBQXdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNySSxPQUFPO0lBQ1IsQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztRQUMzQixPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssT0FBTyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssTUFBTSxFQUFFLENBQUM7UUFDckQsSUFBSSxNQUFNLENBQUMsSUFBSSx3Q0FBZ0MsRUFBRSxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxLQUFLLENBQUMsc0NBQXNDLElBQUksQ0FBQyxHQUFHLHlEQUF5RCxDQUFDLENBQUM7WUFDdEgsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzdELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxLQUFLLENBQUMsMkNBQTJDLElBQUksQ0FBQyxHQUFHLHlCQUF5QixpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDOUcsT0FBTztRQUNSLENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssTUFBTSxFQUFFLENBQUM7UUFDM0IsSUFBSSxNQUFNLENBQUMsSUFBSSx5Q0FBaUMsRUFBRSxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLElBQUksQ0FBQyxHQUFHLHdEQUF3RCxDQUFDLENBQUM7WUFDL0csT0FBTztRQUNSLENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxJQUFJLENBQUMsR0FBRyx3Q0FBd0MsQ0FBQyxDQUFDO0lBQ3pHLE9BQU87QUFDUixDQUFDO0FBRUQsTUFBTSxVQUFVLHVCQUF1QixDQUFDLEtBQWdCLEVBQUUsTUFBdUIsRUFBRSxNQUFlO0lBQ2pHLE1BQU0sTUFBTSxHQUFtQixFQUFFLENBQUM7SUFDbEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsS0FBSyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sR0FBRyxHQUFHLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNWLFNBQVM7UUFDVixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEgsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNYLEdBQUcsRUFBRSxHQUFHO1lBQ1IsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMseUJBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyxDQUFDLHdCQUFnQixDQUFDLHNCQUFjO1lBQ3hHLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMxQixNQUFNLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3pFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztTQUNwQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFFN0QsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxPQUFPLFFBQVE7SUFDYixNQUFNLENBQUMsVUFBVSxDQUFDLEtBQWlDO1FBQ3pELE9BQU8sUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNHLENBQUM7SUFFTSxNQUFNLENBQUMsVUFBVSxDQUFDLEtBQWlDO1FBQ3pELE9BQU8sSUFBSSxRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxZQUF1QyxNQUFlO1FBQWYsV0FBTSxHQUFOLE1BQU0sQ0FBUztJQUFJLENBQUM7SUFFM0QsTUFBTSxDQUFDLElBQVk7UUFDbEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUkseUJBQWlCLENBQUM7UUFDekQsSUFBSSxJQUFJLEVBQUUsS0FBSywwQkFBa0IsRUFBRSxDQUFDO1lBQ25DLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzNCLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwwQkFBa0IsQ0FBQztRQUMzRCxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDMUQsQ0FBQztJQUVPLGdCQUFnQixDQUFDLElBQVksRUFBRSxLQUFnQjtRQUN0RCxJQUFJLGFBQWdDLENBQUM7UUFFckMsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEMsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSywwQkFBa0IsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDLENBQUMsa0NBQWtDO2dCQUN6SCxhQUFhLEdBQUcsSUFBSSxDQUFDO2dCQUVyQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUM7Z0JBQzNELElBQUksWUFBWSxFQUFFLENBQUM7b0JBQ2xCLE9BQU8sRUFBRSxHQUFHLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO2dCQUMzQyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLGFBQWEsQ0FBQztJQUN0QixDQUFDO0NBQ0QifQ==