/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { join } from '../common/path.js';
import { promises } from 'fs';
import { mark } from '../common/performance.js';
import { Promises } from './pfs.js';
export async function resolveNLSConfiguration({ userLocale, osLocale, userDataPath, commit, nlsMetadataPath }) {
    mark('code/willGenerateNls');
    if (process.env['VSCODE_DEV'] ||
        userLocale === 'pseudo' ||
        userLocale.startsWith('en') ||
        !commit ||
        !userDataPath) {
        return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
    }
    try {
        const languagePacks = await getLanguagePackConfigurations(userDataPath);
        if (!languagePacks) {
            return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
        }
        const resolvedLanguage = resolveLanguagePackLanguage(languagePacks, userLocale);
        if (!resolvedLanguage) {
            return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
        }
        const languagePack = languagePacks[resolvedLanguage];
        const mainLanguagePackPath = languagePack?.translations?.['vscode'];
        if (!languagePack ||
            typeof languagePack.hash !== 'string' ||
            !languagePack.translations ||
            typeof mainLanguagePackPath !== 'string' ||
            !(await Promises.exists(mainLanguagePackPath))) {
            return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
        }
        const languagePackId = `${languagePack.hash}.${resolvedLanguage}`;
        const globalLanguagePackCachePath = join(userDataPath, 'clp', languagePackId);
        const commitLanguagePackCachePath = join(globalLanguagePackCachePath, commit);
        const languagePackMessagesFile = join(commitLanguagePackCachePath, 'nls.messages.json');
        const translationsConfigFile = join(globalLanguagePackCachePath, 'tcf.json');
        const languagePackCorruptMarkerFile = join(globalLanguagePackCachePath, 'corrupted.info');
        if (await Promises.exists(languagePackCorruptMarkerFile)) {
            await promises.rm(globalLanguagePackCachePath, { recursive: true, force: true, maxRetries: 3 }); // delete corrupted cache folder
        }
        const result = {
            userLocale,
            osLocale,
            resolvedLanguage,
            defaultMessagesFile: join(nlsMetadataPath, 'nls.messages.json'),
            languagePack: {
                translationsConfigFile,
                messagesFile: languagePackMessagesFile,
                corruptMarkerFile: languagePackCorruptMarkerFile
            },
            // NLS: below properties are a relic from old times only used by vscode-nls and deprecated
            locale: userLocale,
            availableLanguages: { '*': resolvedLanguage },
            _languagePackId: languagePackId,
            _languagePackSupport: true,
            _translationsConfigFile: translationsConfigFile,
            _cacheRoot: globalLanguagePackCachePath,
            _resolvedLanguagePackCoreLocation: commitLanguagePackCachePath,
            _corruptedFile: languagePackCorruptMarkerFile
        };
        if (await Promises.exists(languagePackMessagesFile)) {
            touch(commitLanguagePackCachePath).catch(() => { }); // We don't wait for this. No big harm if we can't touch
            mark('code/didGenerateNls');
            return result;
        }
        const [nlsDefaultKeys, nlsDefaultMessages, nlsPackdata] 
        //      ^moduleId ^nlsKeys                               ^moduleId      ^nlsKey ^nlsValue
        = await Promise.all([
            promises.readFile(join(nlsMetadataPath, 'nls.keys.json'), 'utf-8').then(content => JSON.parse(content)),
            promises.readFile(join(nlsMetadataPath, 'nls.messages.json'), 'utf-8').then(content => JSON.parse(content)),
            promises.readFile(mainLanguagePackPath, 'utf-8').then(content => JSON.parse(content)),
        ]);
        const nlsResult = [];
        // We expect NLS messages to be in a flat array in sorted order as they
        // where produced during build time. We use `nls.keys.json` to know the
        // right order and then lookup the related message from the translation.
        // If a translation does not exist, we fallback to the default message.
        let nlsIndex = 0;
        for (const [moduleId, nlsKeys] of nlsDefaultKeys) {
            const moduleTranslations = nlsPackdata.contents[moduleId];
            for (const nlsKey of nlsKeys) {
                nlsResult.push(moduleTranslations?.[nlsKey] || nlsDefaultMessages[nlsIndex]);
                nlsIndex++;
            }
        }
        await promises.mkdir(commitLanguagePackCachePath, { recursive: true });
        await Promise.all([
            promises.writeFile(languagePackMessagesFile, JSON.stringify(nlsResult), 'utf-8'),
            promises.writeFile(translationsConfigFile, JSON.stringify(languagePack.translations), 'utf-8')
        ]);
        mark('code/didGenerateNls');
        return result;
    }
    catch (error) {
        console.error('Generating translation files failed.', error);
    }
    return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
}
/**
 * The `languagepacks.json` file is a JSON file that contains all metadata
 * about installed language extensions per language. Specifically, for
 * core (`vscode`) and all extensions it supports, it points to the related
 * translation files.
 *
 * The file is updated whenever a new language pack is installed or removed.
 */
async function getLanguagePackConfigurations(userDataPath) {
    const configFile = join(userDataPath, 'languagepacks.json');
    try {
        return JSON.parse(await promises.readFile(configFile, 'utf-8'));
    }
    catch (err) {
        return undefined; // Do nothing. If we can't read the file we have no language pack config.
    }
}
function resolveLanguagePackLanguage(languagePacks, locale) {
    try {
        while (locale) {
            if (languagePacks[locale]) {
                return locale;
            }
            const index = locale.lastIndexOf('-');
            if (index > 0) {
                locale = locale.substring(0, index);
            }
            else {
                return undefined;
            }
        }
    }
    catch (error) {
        console.error('Resolving language pack configuration failed.', error);
    }
    return undefined;
}
function defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath) {
    mark('code/didGenerateNls');
    return {
        userLocale,
        osLocale,
        resolvedLanguage: 'en',
        defaultMessagesFile: join(nlsMetadataPath, 'nls.messages.json'),
        // NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
        locale: userLocale,
        availableLanguages: {}
    };
}
//#region fs helpers
function touch(path) {
    const date = new Date();
    return promises.utimes(path, date, date);
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2Uvbm9kZS9ubHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3pDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDOUIsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRWhELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFnQ3BDLE1BQU0sQ0FBQyxLQUFLLFVBQVUsdUJBQXVCLENBQUMsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFtQztJQUM3SSxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUU3QixJQUNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1FBQ3pCLFVBQVUsS0FBSyxRQUFRO1FBQ3ZCLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQzNCLENBQUMsTUFBTTtRQUNQLENBQUMsWUFBWSxFQUNaLENBQUM7UUFDRixPQUFPLHVCQUF1QixDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELElBQUksQ0FBQztRQUNKLE1BQU0sYUFBYSxHQUFHLE1BQU0sNkJBQTZCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sdUJBQXVCLENBQUMsVUFBVSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxnQkFBZ0IsR0FBRywyQkFBMkIsQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGdCQUFnQixF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