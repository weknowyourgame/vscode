/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from './buffer.js';
import { URI } from './uri.js';
export function stringify(obj) {
    return JSON.stringify(obj, replacer);
}
export function parse(text) {
    let data = JSON.parse(text);
    data = revive(data);
    return data;
}
function replacer(key, value) {
    // URI is done via toJSON-member
    if (value instanceof RegExp) {
        return {
            $mid: 2 /* MarshalledId.Regexp */,
            source: value.source,
            flags: value.flags,
        };
    }
    return value;
}
export function revive(obj, depth = 0) {
    if (!obj || depth > 200) {
        return obj;
    }
    if (typeof obj === 'object') {
        switch (obj.$mid) {
            // eslint-disable-next-line local/code-no-any-casts
            case 1 /* MarshalledId.Uri */: return URI.revive(obj);
            // eslint-disable-next-line local/code-no-any-casts
            case 2 /* MarshalledId.Regexp */: return new RegExp(obj.source, obj.flags);
            // eslint-disable-next-line local/code-no-any-casts
            case 17 /* MarshalledId.Date */: return new Date(obj.source);
        }
        if (obj instanceof VSBuffer
            || obj instanceof Uint8Array) {
            // eslint-disable-next-line local/code-no-any-casts
            return obj;
        }
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; ++i) {
                obj[i] = revive(obj[i], depth + 1);
            }
        }
        else {
            // walk object
            for (const key in obj) {
                if (Object.hasOwnProperty.call(obj, key)) {
                    obj[key] = revive(obj[key], depth + 1);
                }
            }
        }
    }
    return obj;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFyc2hhbGxpbmcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vbWFyc2hhbGxpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN2QyxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLFVBQVUsQ0FBQztBQUc5QyxNQUFNLFVBQVUsU0FBUyxDQUFDLEdBQVk7SUFDckMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN0QyxDQUFDO0FBRUQsTUFBTSxVQUFVLEtBQUssQ0FBQyxJQUFZO0lBQ2pDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQixPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFNRCxTQUFTLFFBQVEsQ0FBQyxHQUFXLEVBQUUsS0FBVTtJQUN4QyxnQ0FBZ0M7SUFDaEMsSUFBSSxLQUFLLFlBQVksTUFBTSxFQUFFLENBQUM7UUFDN0IsT0FBTztZQUNOLElBQUksNkJBQXFCO1lBQ3pCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtZQUNwQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7U0FDbEIsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFXRCxNQUFNLFVBQVUsTUFBTSxDQUFVLEdBQVEsRUFBRSxLQUFLLEdBQUcsQ0FBQztJQUNsRCxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUN6QixPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBRTdCLFFBQTJCLEdBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUN0QyxtREFBbUQ7WUFDbkQsNkJBQXFCLENBQUMsQ0FBQyxPQUFZLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkQsbURBQW1EO1lBQ25ELGdDQUF3QixDQUFDLENBQUMsT0FBWSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4RSxtREFBbUQ7WUFDbkQsK0JBQXNCLENBQUMsQ0FBQyxPQUFZLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBRUQsSUFDQyxHQUFHLFlBQVksUUFBUTtlQUNwQixHQUFHLFlBQVksVUFBVSxFQUMzQixDQUFDO1lBQ0YsbURBQW1EO1lBQ25ELE9BQVksR0FBRyxDQUFDO1FBQ2pCLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN4QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNyQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsY0FBYztZQUNkLEtBQUssTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQzFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sR0FBRyxDQUFDO0FBQ1osQ0FBQyJ9