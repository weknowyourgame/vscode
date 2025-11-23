/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fromNow } from '../../../base/common/date.js';
import { isLinuxSnap } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { process } from '../../../base/parts/sandbox/electron-browser/globals.js';
export function createNativeAboutDialogDetails(productService, osProps) {
    let version = productService.version;
    if (productService.target) {
        version = `${version} (${productService.target} setup)`;
    }
    else if (productService.darwinUniversalAssetId) {
        version = `${version} (Universal)`;
    }
    const getDetails = (useAgo) => {
        return localize({ key: 'aboutDetail', comment: ['Electron, Chromium, Node.js and V8 are product names that need no translation'] }, "Version: {0}\nCommit: {1}\nDate: {2}\nElectron: {3}\nElectronBuildId: {4}\nChromium: {5}\nNode.js: {6}\nV8: {7}\nOS: {8}", version, productService.commit || 'Unknown', productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown', process.versions['electron'], process.versions['microsoft-build'], process.versions['chrome'], process.versions['node'], process.versions['v8'], `${osProps.type} ${osProps.arch} ${osProps.release}${isLinuxSnap ? ' snap' : ''}`);
    };
    const details = getDetails(true);
    const detailsToCopy = getDetails(false);
    return {
        title: productService.nameLong,
        details: details,
        detailsToCopy: detailsToCopy
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2RpYWxvZ3MvZWxlY3Ryb24tYnJvd3Nlci9kaWFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFHM0MsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRWxGLE1BQU0sVUFBVSw4QkFBOEIsQ0FBQyxjQUErQixFQUFFLE9BQXNCO0lBQ3JHLElBQUksT0FBTyxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUM7SUFDckMsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDM0IsT0FBTyxHQUFHLEdBQUcsT0FBTyxLQUFLLGNBQWMsQ0FBQyxNQUFNLFNBQVMsQ0FBQztJQUN6RCxDQUFDO1NBQU0sSUFBSSxjQUFjLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUNsRCxPQUFPLEdBQUcsR0FBRyxPQUFPLGNBQWMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUFlLEVBQVUsRUFBRTtRQUM5QyxPQUFPLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLENBQUMsK0VBQStFLENBQUMsRUFBRSxFQUNqSSwwSEFBMEgsRUFDMUgsT0FBTyxFQUNQLGNBQWMsQ0FBQyxNQUFNLElBQUksU0FBUyxFQUNsQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQ3BJLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQzVCLE9BQU8sQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFDbkMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFDMUIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFDeEIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDdEIsR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQ2pGLENBQUM7SUFDSCxDQUFDLENBQUM7SUFFRixNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXhDLE9BQU87UUFDTixLQUFLLEVBQUUsY0FBYyxDQUFDLFFBQVE7UUFDOUIsT0FBTyxFQUFFLE9BQU87UUFDaEIsYUFBYSxFQUFFLGFBQWE7S0FDNUIsQ0FBQztBQUNILENBQUMifQ==