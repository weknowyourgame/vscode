/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Creates a tool result with a single text content part.
 */
export function createToolSimpleTextResult(value) {
    return {
        content: [{
                kind: 'text',
                value
            }]
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbEhlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vdG9vbHMvdG9vbEhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEc7O0dBRUc7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsS0FBYTtJQUN2RCxPQUFPO1FBQ04sT0FBTyxFQUFFLENBQUM7Z0JBQ1QsSUFBSSxFQUFFLE1BQU07Z0JBQ1osS0FBSzthQUNMLENBQUM7S0FDRixDQUFDO0FBQ0gsQ0FBQyJ9