/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isObject, isString } from '../../../base/common/types.js';
import { localize } from '../../../nls.js';
export function localizeManifest(logger, extensionManifest, translations, fallbackTranslations) {
    try {
        replaceNLStrings(logger, extensionManifest, translations, fallbackTranslations);
    }
    catch (error) {
        logger.error(error?.message ?? error);
        /*Ignore Error*/
    }
    return extensionManifest;
}
/**
 * This routine makes the following assumptions:
 * The root element is an object literal
 */
function replaceNLStrings(logger, extensionManifest, messages, originalMessages) {
    const processEntry = (obj, key, command) => {
        const value = obj[key];
        if (isString(value)) {
            const str = value;
            const length = str.length;
            if (length > 1 && str[0] === '%' && str[length - 1] === '%') {
                const messageKey = str.substr(1, length - 2);
                let translated = messages[messageKey];
                // If the messages come from a language pack they might miss some keys
                // Fill them from the original messages.
                if (translated === undefined && originalMessages) {
                    translated = originalMessages[messageKey];
                }
                const message = typeof translated === 'string' ? translated : translated?.message;
                // This branch returns ILocalizedString's instead of Strings so that the Command Palette can contain both the localized and the original value.
                const original = originalMessages?.[messageKey];
                const originalMessage = typeof original === 'string' ? original : original?.message;
                if (!message) {
                    if (!originalMessage) {
                        logger.warn(`[${extensionManifest.name}]: ${localize('missingNLSKey', "Couldn't find message for key {0}.", messageKey)}`);
                    }
                    return;
                }
                if (
                // if we are translating the title or category of a command
                command && (key === 'title' || key === 'category') &&
                    // and the original value is not the same as the translated value
                    originalMessage && originalMessage !== message) {
                    const localizedString = {
                        value: message,
                        original: originalMessage
                    };
                    obj[key] = localizedString;
                }
                else {
                    obj[key] = message;
                }
            }
        }
        else if (isObject(value)) {
            for (const k in value) {
                if (value.hasOwnProperty(k)) {
                    k === 'commands' ? processEntry(value, k, true) : processEntry(value, k, command);
                }
            }
        }
        else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                processEntry(value, i, command);
            }
        }
    };
    for (const key in extensionManifest) {
        if (extensionManifest.hasOwnProperty(key)) {
            processEntry(extensionManifest, key);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTmxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk5scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBR25FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQU8zQyxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsTUFBZSxFQUFFLGlCQUFxQyxFQUFFLFlBQTJCLEVBQUUsb0JBQW9DO0lBQ3pKLElBQUksQ0FBQztRQUNKLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNoQixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLElBQUksS0FBSyxDQUFDLENBQUM7UUFDdEMsZ0JBQWdCO0lBQ2pCLENBQUM7SUFDRCxPQUFPLGlCQUFpQixDQUFDO0FBQzFCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLGdCQUFnQixDQUFDLE1BQWUsRUFBRSxpQkFBcUMsRUFBRSxRQUF1QixFQUFFLGdCQUFnQztJQUMxSSxNQUFNLFlBQVksR0FBRyxDQUFDLEdBQTRCLEVBQUUsR0FBb0IsRUFBRSxPQUFpQixFQUFFLEVBQUU7UUFDOUYsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDckIsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFDMUIsSUFBSSxN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