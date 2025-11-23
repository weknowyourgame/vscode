/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareIgnoreCase } from '../../../base/common/strings.js';
import { getTargetPlatform } from './extensionManagement.js';
import { ExtensionIdentifier, UNDEFINED_PUBLISHER } from '../../extensions/common/extensions.js';
import { isLinux, platform } from '../../../base/common/platform.js';
import { URI } from '../../../base/common/uri.js';
import { getErrorMessage } from '../../../base/common/errors.js';
import { arch } from '../../../base/common/process.js';
import { TelemetryTrustedValue } from '../../telemetry/common/telemetryUtils.js';
import { isString } from '../../../base/common/types.js';
export function areSameExtensions(a, b) {
    if (a.uuid && b.uuid) {
        return a.uuid === b.uuid;
    }
    if (a.id === b.id) {
        return true;
    }
    return compareIgnoreCase(a.id, b.id) === 0;
}
const ExtensionKeyRegex = /^([^.]+\..+)-(\d+\.\d+\.\d+)(-(.+))?$/;
export class ExtensionKey {
    static create(extension) {
        const version = extension.manifest ? extension.manifest.version : extension.version;
        const targetPlatform = extension.manifest ? extension.targetPlatform : extension.properties.targetPlatform;
        return new ExtensionKey(extension.identifier, version, targetPlatform);
    }
    static parse(key) {
        const matches = ExtensionKeyRegex.exec(key);
        return matches && matches[1] && matches[2] ? new ExtensionKey({ id: matches[1] }, matches[2], matches[4] || undefined) : null;
    }
    constructor(identifier, version, targetPlatform = "undefined" /* TargetPlatform.UNDEFINED */) {
        this.identifier = identifier;
        this.version = version;
        this.targetPlatform = targetPlatform;
        this.id = identifier.id;
    }
    toString() {
        return `${this.id}-${this.version}${this.targetPlatform !== "undefined" /* TargetPlatform.UNDEFINED */ ? `-${this.targetPlatform}` : ''}`;
    }
    equals(o) {
        if (!(o instanceof ExtensionKey)) {
            return false;
        }
        return areSameExtensions(this, o) && this.version === o.version && this.targetPlatform === o.targetPlatform;
    }
}
const EXTENSION_IDENTIFIER_WITH_VERSION_REGEX = /^([^.]+\..+)@((prerelease)|(\d+\.\d+\.\d+(-.*)?))$/;
export function getIdAndVersion(id) {
    const matches = EXTENSION_IDENTIFIER_WITH_VERSION_REGEX.exec(id);
    if (matches && matches[1]) {
        return [adoptToGalleryExtensionId(matches[1]), matches[2]];
    }
    return [adoptToGalleryExtensionId(id), undefined];
}
export function getExtensionId(publisher, name) {
    return `${publisher}.${name}`;
}
export function adoptToGalleryExtensionId(id) {
    return id.toLowerCase();
}
export function getGalleryExtensionId(publisher, name) {
    return adoptToGalleryExtensionId(getExtensionId(publisher ?? UNDEFINED_PUBLISHER, name));
}
export function groupByExtension(extensions, getExtensionIdentifier) {
    const byExtension = [];
    const findGroup = (extension) => {
        for (const group of byExtension) {
            if (group.some(e => areSameExtensions(getExtensionIdentifier(e), getExtensionIdentifier(extension)))) {
                return group;
            }
        }
        return null;
    };
    for (const extension of extensions) {
        const group = findGroup(extension);
        if (group) {
            group.push(extension);
        }
        else {
            byExtension.push([extension]);
        }
    }
    return byExtension;
}
export function getLocalExtensionTelemetryData(extension) {
    return {
        id: extension.identifier.id,
        name: extension.manifest.name,
        galleryId: null,
        publisherId: extension.publisherId,
        publisherName: extension.manifest.publisher,
        publisherDisplayName: extension.publisherDisplayName,
        dependencies: extension.manifest.extensionDependencies && extension.manifest.extensionDependencies.length > 0
    };
}
/* __GDPR__FRAGMENT__
    "GalleryExtensionTelemetryData" : {
        "id" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "name": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "extensionVersion": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "galleryId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "publisherId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "publisherName": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "publisherDisplayName": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "isPreReleaseVersion": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "dependencies": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
        "isSigned": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "${include}": [
            "${GalleryExtensionTelemetryData2}"
        ]
    }
*/
export function getGalleryExtensionTelemetryData(extension) {
    return {
        id: new TelemetryTrustedValue(extension.identifier.id),
        name: new TelemetryTrustedValue(extension.name),
        extensionVersion: extension.version,
        galleryId: extension.identifier.uuid,
        publisherId: extension.publisherId,
        publisherName: extension.publisher,
        publisherDisplayName: extension.publisherDisplayName,
        isPreReleaseVersion: extension.properties.isPreReleaseVersion,
        dependencies: !!(extension.properties.dependencies && extension.properties.dependencies.length > 0),
        isSigned: extension.isSigned,
        ...extension.telemetryData
    };
}
export const BetterMergeId = new ExtensionIdentifier('pprice.better-merge');
export function getExtensionDependencies(installedExtensions, extension) {
    const dependencies = [];
    const extensions = extension.manifest.extensionDependencies?.slice(0) ?? [];
    while (extensions.length) {
        const id = extensions.shift();
        if (id && dependencies.every(e => !areSameExtensions(e.identifier, { id }))) {
            const ext = installedExtensions.filter(e => areSameExtensions(e.identifier, { id }));
            if (ext.length === 1) {
                dependencies.push(ext[0]);
                extensions.push(...ext[0].manifest.extensionDependencies?.slice(0) ?? []);
            }
        }
    }
    return dependencies;
}
async function isAlpineLinux(fileService, logService) {
    if (!isLinux) {
        return false;
    }
    let content;
    try {
        const fileContent = await fileService.readFile(URI.file('/etc/os-release'));
        content = fileContent.value.toString();
    }
    catch (error) {
        try {
            const fileContent = await fileService.readFile(URI.file('/usr/lib/os-release'));
            content = fileContent.value.toString();
        }
        catch (error) {
            /* Ignore */
            logService.debug(`Error while getting the os-release file.`, getErrorMessage(error));
        }
    }
    return !!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === 'alpine';
}
export async function computeTargetPlatform(fileService, logService) {
    const alpineLinux = await isAlpineLinux(fileService, logService);
    const targetPlatform = getTargetPlatform(alpineLinux ? 'alpine' : platform, arch);
    logService.debug('ComputeTargetPlatform:', targetPlatform);
    return targetPlatform;
}
export function isMalicious(identifier, malicious) {
    return findMatchingMaliciousEntry(identifier, malicious) !== undefined;
}
export function findMatchingMaliciousEntry(identifier, malicious) {
    return malicious.find(({ extensionOrPublisher }) => {
        if (isString(extensionOrPublisher)) {
            return compareIgnoreCase(identifier.id.split('.')[0], extensionOrPublisher) === 0;
        }
        return areSameExtensions(identifier, extensionOrPublisher);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEUsT0FBTyxFQUFvRixpQkFBaUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9JLE9BQU8sRUFBRSxtQkFBbUIsRUFBOEIsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUU3SCxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFakUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV6RCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsQ0FBdUIsRUFBRSxDQUF1QjtJQUNqRixJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RCLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFDRCxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25CLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNELE9BQU8saUJBQWlCLENB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