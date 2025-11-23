/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class StandaloneTreeSitterLibraryService {
    getParserClass() {
        throw new Error('not implemented in StandaloneTreeSitterLibraryService');
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
        throw new Error('not implemented in StandaloneTreeSitterLibraryService');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhbG9uZVRyZWVTaXR0ZXJMaWJyYXJ5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3N0YW5kYWxvbmVUcmVlU2l0dGVyTGlicmFyeVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFNaEcsTUFBTSxPQUFPLGtDQUFrQztJQUc5QyxjQUFjO1FBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxVQUFrQixFQUFFLE1BQTJCO1FBQy9ELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELFdBQVcsQ0FBQyxVQUFrQixFQUFFLG1CQUE0QixFQUFFLE1BQTJCO1FBQ3hGLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxLQUFLLENBQUMsa0JBQWtCLENBQUMsVUFBa0I7UUFDMUMsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELG1CQUFtQixDQUFDLFVBQWtCLEVBQUUsTUFBMkI7UUFDbEUsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQsc0JBQXNCLENBQUMsVUFBa0IsRUFBRSxNQUEyQjtRQUNyRSxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQWtCLEVBQUUsV0FBbUI7UUFDeEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0lBQzFFLENBQUM7Q0FDRCJ9