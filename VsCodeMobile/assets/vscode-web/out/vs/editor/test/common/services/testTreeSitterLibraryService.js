/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class TestTreeSitterLibraryService {
    getParserClass() {
        throw new Error('not implemented in TestTreeSitterLibraryService');
    }
    supportsLanguage(languageId, reader) {
        return false;
    }
    getLanguage(languageId, ignoreSupportsCheck, reader) {
        return undefined;
    }
    async getLanguagePromise(languageId) {
        return undefined;
    }
    getInjectionQueries(languageId, reader) {
        return null;
    }
    getHighlightingQueries(languageId, reader) {
        return null;
    }
    async createQuery(language, querySource) {
        throw new Error('not implemented in TestTreeSitterLibraryService');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFRyZWVTaXR0ZXJMaWJyYXJ5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvdGVzdFRyZWVTaXR0ZXJMaWJyYXJ5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQU1oRyxNQUFNLE9BQU8sNEJBQTRCO0lBR3hDLGNBQWM7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELGdCQUFnQixDQUFDLFVBQWtCLEVBQUUsTUFBMkI7UUFDL0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsV0FBVyxDQUFDLFVBQWtCLEVBQUUsbUJBQTRCLEVBQUUsTUFBMkI7UUFDeEYsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxVQUFrQjtRQUMxQyxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsbUJBQW1CLENBQUMsVUFBa0IsRUFBRSxNQUEyQjtRQUNsRSxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxVQUFrQixFQUFFLE1BQTJCO1FBQ3JFLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBa0IsRUFBRSxXQUFtQjtRQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7SUFDcEUsQ0FBQztDQUNEIn0=