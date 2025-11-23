/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { parse } from '../../../base/common/glob.js';
import { Mimes } from '../../../base/common/mime.js';
import { Schemas } from '../../../base/common/network.js';
import { basename, posix } from '../../../base/common/path.js';
import { DataUri } from '../../../base/common/resources.js';
import { endsWithIgnoreCase, equals, startsWithUTF8BOM } from '../../../base/common/strings.js';
import { PLAINTEXT_LANGUAGE_ID } from '../languages/modesRegistry.js';
let registeredAssociations = [];
let nonUserRegisteredAssociations = [];
let userRegisteredAssociations = [];
/**
 * Associate a language to the registry (platform).
 * * **NOTE**: This association will lose over associations registered using `registerConfiguredLanguageAssociation`.
 * * **NOTE**: Use `clearPlatformLanguageAssociations` to remove all associations registered using this function.
 */
export function registerPlatformLanguageAssociation(association, warnOnOverwrite = false) {
    _registerLanguageAssociation(association, false, warnOnOverwrite);
}
/**
 * Associate a language to the registry (configured).
 * * **NOTE**: This association will win over associations registered using `registerPlatformLanguageAssociation`.
 * * **NOTE**: Use `clearConfiguredLanguageAssociations` to remove all associations registered using this function.
 */
export function registerConfiguredLanguageAssociation(association) {
    _registerLanguageAssociation(association, true, false);
}
function _registerLanguageAssociation(association, userConfigured, warnOnOverwrite) {
    // Register
    const associationItem = toLanguageAssociationItem(association, userConfigured);
    registeredAssociations.push(associationItem);
    if (!associationItem.userConfigured) {
        nonUserRegisteredAssociations.push(associationItem);
    }
    else {
        userRegisteredAssociations.push(associationItem);
    }
    // Check for conflicts unless this is a user configured association
    if (warnOnOverwrite && !associationItem.userConfigured) {
        registeredAssociations.forEach(a => {
            if (a.mime === associationItem.mime || a.userConfigured) {
                return; // same mime or userConfigured is ok
            }
            if (associationItem.extension && a.extension === associationItem.extension) {
                console.warn(`Overwriting extension <<${associationItem.extension}>> to now point to mime <<${associationItem.mime}>>`);
            }
            if (associationItem.filename && a.filename === associationItem.filename) {
                console.warn(`Overwriting filename <<${associationItem.filename}>> to now point to mime <<${associationItem.mime}>>`);
            }
            if (associationItem.filepattern && a.filepattern === associationItem.filepattern) {
                console.warn(`Overwriting filepattern <<${associationItem.filepattern}>> to now point to mime <<${associationItem.mime}>>`);
            }
            if (associationItem.firstline && a.firstline === associationItem.firstline) {
                console.warn(`Overwriting firstline <<${associationItem.firstline}>> to now point to mime <<${associationItem.mime}>>`);
            }
        });
    }
}
function toLanguageAssociationItem(association, userConfigured) {
    return {
        id: association.id,
        mime: association.mime,
        filename: association.filename,
        extension: association.extension,
        filepattern: association.filepattern,
        firstline: association.firstline,
        userConfigured: userConfigured,
        filepatternParsed: association.filepattern ? parse(association.filepattern, { ignoreCase: true }) : undefined,
        filepatternOnPath: association.filepattern ? association.filepattern.indexOf(posix.sep) >= 0 : false
    };
}
/**
 * Clear language associations from the registry (platform).
 */
export function clearPlatformLanguageAssociations() {
    registeredAssociations = registeredAssociations.filter(a => a.userConfigured);
    nonUserRegisteredAssociations = [];
}
/**
 * Clear language associations from the registry (configured).
 */
export function clearConfiguredLanguageAssociations() {
    registeredAssociations = registeredAssociations.filter(a => !a.userConfigured);
    userRegisteredAssociations = [];
}
/**
 * Given a file, return the best matching mime types for it
 * based on the registered language associations.
 */
export function getMimeTypes(resource, firstLine) {
    return getAssociations(resource, firstLine).map(item => item.mime);
}
/**
 * @see `getMimeTypes`
 */
export function getLanguageIds(resource, firstLine) {
    return getAssociations(resource, firstLine).map(item => item.id);
}
function getAssociations(resource, firstLine) {
    let path;
    if (resource) {
        switch (resource.scheme) {
            case Schemas.file:
                path = resource.fsPath;
                break;
            case Schemas.data: {
                const metadata = DataUri.parseMetaData(resource);
                path = metadata.get(DataUri.META_DATA_LABEL);
                break;
            }
            case Schemas.vscodeNotebookCell:
                // File path not relevant for language detection of cell
                path = undefined;
                break;
            default:
                path = resource.path;
        }
    }
    if (!path) {
        return [{ id: 'unknown', mime: Mimes.unknown }];
    }
    path = path.toLowerCase();
    const filename = basename(path);
    // 1.) User configured mappings have highest priority
    const configuredLanguage = getAssociationByPath(path, filename, userRegisteredAssociations);
    if (configuredLanguage) {
        return [configuredLanguage, { id: PLAINTEXT_LANGUAGE_ID, mime: Mimes.text }];
    }
    // 2.) Registered mappings have middle priority
    const registeredLanguage = getAssociationByPath(path, filename, nonUserRegisteredAssociations);
    if (registeredLanguage) {
        return [registeredLanguage, { id: PLAINTEXT_LANGUAGE_ID, mime: Mimes.text }];
    }
    // 3.) Firstline has lowest priority
    if (firstLine) {
        const firstlineLanguage = getAssociationByFirstline(firstLine);
        if (firstlineLanguage) {
            return [firstlineLanguage, { id: PLAINTEXT_LANGUAGE_ID, mime: Mimes.text }];
        }
    }
    return [{ id: 'unknown', mime: Mimes.unknown }];
}
function getAssociationByPath(path, filename, associations) {
    let filenameMatch = undefined;
    let patternMatch = undefined;
    let extensionMatch = undefined;
    // We want to prioritize associations based on the order they are registered so that the last registered
    // association wins over all other. This is for https://github.com/microsoft/vscode/issues/20074
    for (let i = associations.length - 1; i >= 0; i--) {
        const association = associations[i];
        // First exact name match
        if (equals(filename, association.filename, true)) {
            filenameMatch = association;
            break; // take it!
        }
        // Longest pattern match
        if (association.filepattern) {
            if (!patternMatch || association.filepattern.length > patternMatch.filepattern.length) {
                const target = association.filepatternOnPath ? path : filename; // match on full path if pattern contains path separator
                if (association.filepatternParsed?.(target)) {
                    patternMatch = association;
                }
            }
        }
        // Longest extension match
        if (association.extension) {
            if (!extensionMatch || association.extension.length > extensionMatch.extension.length) {
                if (endsWithIgnoreCase(filename, association.extension)) {
                    extensionMatch = association;
                }
            }
        }
    }
    // 1.) Exact name match has second highest priority
    if (filenameMatch) {
        return filenameMatch;
    }
    // 2.) Match on pattern
    if (patternMatch) {
        return patternMatch;
    }
    // 3.) Match on extension comes next
    if (extensionMatch) {
        return extensionMatch;
    }
    return undefined;
}
function getAssociationByFirstline(firstLine) {
    if (startsWithUTF8BOM(firstLine)) {
        firstLine = firstLine.substring(1);
    }
    if (firstLine.length > 0) {
        // We want to prioritize associations based on the order they are registered so that the last registered
        // association wins over all other. This is for https://github.com/microsoft/vscode/issues/20074
        for (let i = registeredAssociations.length - 1; i >= 0; i--) {
            const association = registeredAssociations[i];
            if (!association.firstline) {
                continue;
            }
            const matches = firstLine.match(association.firstline);
            if (matches && matches.length > 0) {
                return association;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VzQXNzb2NpYXRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VzQXNzb2NpYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBaUIsS0FBSyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFpQnRFLElBQUksc0JBQXNCLEdBQStCLEVBQUUsQ0FBQztBQUM1RCxJQUFJLDZCQUE2QixHQUErQixFQUFFLENBQUM7QUFDbkUsSUFBSSwwQkFBMEIsR0FBK0IsRUFBRSxDQUFDO0FBRWhFOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsbUNBQW1DLENBQUMsV0FBaUMsRUFBRSxlQUFlLEdBQUcsS0FBSztJQUM3Ryw0QkFBNEIsQ0FBQyxXQUFXLEVBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQ25FLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLHFDQUFxQyxDQUFDLFdBQWlDO0lBQ3RGLDRCQUE0QixDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQUMs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